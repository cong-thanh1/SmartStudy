import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface SmartStudyFoundationStackProps extends cdk.StackProps {
  readonly environment: string;
}

export class SmartStudyFoundationStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SmartStudyFoundationStackProps,
  ) {
    super(scope, id, props);

    const frontendOrigin = new cdk.CfnParameter(this, "FrontendOrigin", {
      default: "https://example.invalid",
      description: "HTTPS origin allowed to upload directly to S3.",
      type: "String",
    });
    const suffix = props.environment.toLowerCase();

    const documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["content-type"],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [frontendOrigin.valueAsString],
          maxAge: 900,
        },
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
    });

    const documentDlq = new sqs.Queue(this, "DocumentProcessingDlq", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      queueName: `smartstudy-${suffix}-document-processing-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });
    const documentQueue = new sqs.Queue(this, "DocumentProcessingQueue", {
      deadLetterQueue: { maxReceiveCount: 3, queue: documentDlq },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      queueName: `smartstudy-${suffix}-document-processing`,
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      visibilityTimeout: cdk.Duration.seconds(120),
    });

    const preSignUp = new lambda.Function(this, "PreSignUp", {
      code: lambda.Code.fromInline(
        "exports.handler = async (event) => { event.response.autoConfirmUser = true; event.response.autoVerifyEmail = true; return event; };",
      ),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
    });
    const userPool = new cognito.UserPool(this, "UserPool", {
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { mutable: false, required: true },
        fullname: { mutable: true, required: false },
      },
      lambdaTriggers: { preSignUp },
    });
    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: { userPassword: true },
      generateSecret: false,
      refreshTokenValidity: cdk.Duration.days(30),
    });

    const documentsTable = createTable(this, "DocumentsTable", "documentId");
    documentsTable.addGlobalSecondaryIndex({
      indexName: "ownerId-createdAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });
    const conversationsTable = createTable(this, "ConversationsTable", "conversationId");
    conversationsTable.addGlobalSecondaryIndex({
      indexName: "ownerId-createdAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });
    const attemptsTable = createTable(this, "AttemptsTable", "attemptId");
    attemptsTable.addGlobalSecondaryIndex({
      indexName: "ownerId-submittedAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "submittedAt", type: dynamodb.AttributeType.STRING },
    });
    const usersTable = createTable(this, "UsersTable", "ownerId");

    new cdk.CfnOutput(this, "CognitoClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "DocumentsBucketName", { value: documentsBucket.bucketName });
    new cdk.CfnOutput(this, "DocumentQueueUrl", { value: documentQueue.queueUrl });
    new cdk.CfnOutput(this, "UsersTableName", { value: usersTable.tableName });
  }
}

function createTable(scope: Construct, id: string, partitionKey: string): dynamodb.Table {
  return new dynamodb.Table(scope, id, {
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    partitionKey: { name: partitionKey, type: dynamodb.AttributeType.STRING },
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });
}
