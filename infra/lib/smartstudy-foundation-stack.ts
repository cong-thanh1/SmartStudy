import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3vectors from "aws-cdk-lib/aws-s3vectors";
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
    const vectorBucket = new s3vectors.CfnVectorBucket(this, "VectorBucket", {
      vectorBucketName: `smartstudy-${suffix}-vectors`,
    });
    const vectorIndex = new s3vectors.CfnIndex(this, "VectorIndex", {
      dataType: "float32",
      dimension: 1024,
      distanceMetric: "cosine",
      indexName: `smartstudy-${suffix}-knowledge`,
      vectorBucketArn: vectorBucket.attrVectorBucketArn,
    });
    const knowledgeBaseRole = new iam.Role(this, "KnowledgeBaseRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
    });
    knowledgeBaseRole.addToPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "s3:GetObject", "s3:ListBucket", "s3vectors:*"],
      resources: ["*"],
    }));
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:${cdk.Aws.PARTITION}:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0`,
        },
      },
      name: `smartstudy-${suffix}-knowledge`,
      roleArn: knowledgeBaseRole.roleArn,
      storageConfiguration: {
        type: "S3_VECTORS",
        s3VectorsConfiguration: {
          indexArn: vectorIndex.attrIndexArn,
          vectorBucketArn: vectorBucket.attrVectorBucketArn,
        },
      },
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
    const documentChunksTable = new dynamodb.Table(this, "DocumentChunksTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      partitionKey: { name: "documentId", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      sortKey: { name: "chunkId", type: dynamodb.AttributeType.STRING },
    });
    const conversationsTable = createTable(this, "ConversationsTable", "conversationId");
    conversationsTable.addGlobalSecondaryIndex({
      indexName: "ownerId-createdAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });
    const conversationMessagesTable = new dynamodb.Table(
      this,
      "ConversationMessagesTable",
      {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        encryption: dynamodb.TableEncryption.AWS_MANAGED,
        partitionKey: { name: "conversationId", type: dynamodb.AttributeType.STRING },
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        sortKey: { name: "messageSortKey", type: dynamodb.AttributeType.STRING },
      },
    );
    const attemptsTable = createTable(this, "AttemptsTable", "attemptId");
    attemptsTable.addGlobalSecondaryIndex({
      indexName: "ownerId-submittedAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "submittedAt", type: dynamodb.AttributeType.STRING },
    });
    attemptsTable.addGlobalSecondaryIndex({
      indexName: "ownerId-examSubmittedAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "examSubmittedAt", type: dynamodb.AttributeType.STRING },
    });
    const examsTable = createTable(this, "ExamsTable", "examId");
    examsTable.addGlobalSecondaryIndex({
      indexName: "ownerId-documentCreatedAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "documentCreatedAt", type: dynamodb.AttributeType.STRING },
    });
    const quizzesTable = createTable(this, "QuizzesTable", "quizId");
    quizzesTable.addGlobalSecondaryIndex({
      indexName: "ownerId-documentCreatedAt-index",
      partitionKey: { name: "ownerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "documentCreatedAt", type: dynamodb.AttributeType.STRING },
    });
    const usersTable = createTable(this, "UsersTable", "ownerId");
    const summariesTable = createTable(this, "SummariesTable", "summaryKey");

    new cdk.CfnOutput(this, "CognitoClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "DocumentsBucketName", { value: documentsBucket.bucketName });
    new cdk.CfnOutput(this, "DocumentChunksTableName", {
      value: documentChunksTable.tableName,
    });
    new cdk.CfnOutput(this, "ConversationMessagesTableName", {
      value: conversationMessagesTable.tableName,
    });
    new cdk.CfnOutput(this, "DocumentQueueUrl", { value: documentQueue.queueUrl });
    new cdk.CfnOutput(this, "UsersTableName", { value: usersTable.tableName });
    new cdk.CfnOutput(this, "SummariesTableName", { value: summariesTable.tableName });
    new cdk.CfnOutput(this, "KnowledgeBaseId", { value: knowledgeBase.attrKnowledgeBaseId });
    new cdk.CfnOutput(this, "QuizzesTableName", { value: quizzesTable.tableName });
    new cdk.CfnOutput(this, "ExamsTableName", { value: examsTable.tableName });
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
