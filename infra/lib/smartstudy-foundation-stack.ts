import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3vectors from "aws-cdk-lib/aws-s3vectors";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as path from "node:path";
import { Construct } from "constructs";

export interface SmartStudyFoundationStackProps extends cdk.StackProps {
  readonly environment: string;
  readonly frontendOrigin?: string;
}

export class SmartStudyFoundationStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SmartStudyFoundationStackProps,
  ) {
    super(scope, id, props);

    const frontendOrigin = props.frontendOrigin ?? "https://example.invalid";
    const suffix = props.environment.toLowerCase();

    const documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["content-type"],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [frontendOrigin],
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
    const knowledgeBasePolicy = new iam.Policy(this, "KnowledgeBasePolicy", {
      roles: [knowledgeBaseRole],
      statements: [
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModel", "s3:GetObject", "s3:ListBucket", "s3vectors:*"],
          resources: ["*"],
        }),
      ],
    });
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
    knowledgeBase.node.addDependency(knowledgeBasePolicy);
    const knowledgeBaseDataSource = new bedrock.CfnDataSource(
      this,
      "KnowledgeBaseDocumentsDataSource",
      {
        dataSourceConfiguration: {
          s3Configuration: {
            bucketArn: documentsBucket.bucketArn,
            inclusionPrefixes: ["users/"],
          },
          type: "S3",
        },
        description:
          "Private SmartStudy PDFs and their Bedrock metadata sidecar files.",
        knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
        name: `smartstudy-${suffix}-documents`,
        vectorIngestionConfiguration: {
          chunkingConfiguration: {
            chunkingStrategy: "FIXED_SIZE",
            fixedSizeChunkingConfiguration: {
              maxTokens: 300,
              overlapPercentage: 20,
            },
          },
        },
      },
    );
    knowledgeBaseDataSource.node.addDependency(knowledgeBase);

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
      visibilityTimeout: cdk.Duration.minutes(15),
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

    const sharedEnvironment = {
      ATTEMPTS_TABLE_NAME: attemptsTable.tableName,
      BEDROCK_KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
      BEDROCK_REGION: cdk.Aws.REGION,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      COGNITO_REGION: cdk.Aws.REGION,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      CONVERSATIONS_TABLE_NAME: conversationsTable.tableName,
      CONVERSATION_MESSAGES_TABLE_NAME: conversationMessagesTable.tableName,
      DOCUMENT_CHUNKS_TABLE_NAME: documentChunksTable.tableName,
      DOCUMENTS_TABLE_NAME: documentsTable.tableName,
      EXAMS_TABLE_NAME: examsTable.tableName,
      // Gemini is the active production fallback until Bedrock account access
      // is restored. Bedrock resources remain provisioned for a later switch.
      DOCUMENT_INGESTION_MODE: "dynamodb",
      EMBEDDING_PROVIDER: "none",
      GEMINI_API_KEY_PARAMETER: `/smartstudy/${suffix}/gemini-api-key`,
      GEMINI_MODEL: "gemini-flash-latest",
      LLM_PROVIDER: "gemini",
      AUTH_PROVIDER: "cognito",
      DOCUMENT_PROCESSING_QUEUE: `smartstudy-${suffix}-document-processing`,
      QUEUE_PROVIDER: "sqs",
      SQS_QUEUE_NAME: `smartstudy-${suffix}-document-processing`,
      SQS_QUEUE_URL: documentQueue.queueUrl,
      STORAGE_BUCKET: documentsBucket.bucketName,
      STORAGE_REGION: cdk.Aws.REGION,
      SUMMARIES_TABLE_NAME: summariesTable.tableName,
      QUIZZES_TABLE_NAME: quizzesTable.tableName,
      VECTOR_STORE: "dynamodb-chunks",
    };
    const apiFunction = new lambdaNodejs.NodejsFunction(this, "ApiFunction", {
      bundling: {
        commandHooks: {
          afterBundling(inputDir: string, outputDir: string) {
            return [
              `node -e "require('node:fs').copyFileSync(process.argv[1],process.argv[2])" "${path.join(inputDir, "node_modules/pdfjs-dist-legacy/legacy/build/pdf.worker.js")}" "${path.join(outputDir, "pdf.worker.js")}"`,
            ];
          },
          beforeBundling() {
            return [];
          },
          beforeInstall() {
            return [];
          },
        },
        esbuildArgs: {
          "--alias:@huggingface/transformers": path.join(
            __dirname,
            "../../backend/src/adapters/embedding/lambda-transformers-stub.ts",
          ),
          "--external:canvas": "",
        },
      },
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      entry: path.join(__dirname, "../../backend/src/lambda.ts"),
      environment: sharedEnvironment,
      handler: "handler",
      logRetention: logs.RetentionDays.ONE_MONTH,
      memorySize: 1024,
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(29),
    });
    const ingestionFunction = new lambdaNodejs.NodejsFunction(this, "DocumentIngestionFunction", {
      bundling: {
        commandHooks: {
          afterBundling(inputDir: string, outputDir: string) {
            return [
              `node -e "require('node:fs').copyFileSync(process.argv[1],process.argv[2])" "${path.join(inputDir, "node_modules/pdfjs-dist-legacy/legacy/build/pdf.worker.js")}" "${path.join(outputDir, "pdf.worker.js")}"`,
            ];
          },
          beforeBundling() {
            return [];
          },
          beforeInstall() {
            return [];
          },
        },
        esbuildArgs: {
          "--alias:@huggingface/transformers": path.join(
            __dirname,
            "../../backend/src/adapters/embedding/lambda-transformers-stub.ts",
          ),
          "--external:canvas": "",
        },
      },
      depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),
      entry: path.join(__dirname, "../../backend/src/document-ingestion-lambda.ts"),
      environment: {
        ...sharedEnvironment,
        BEDROCK_KNOWLEDGE_BASE_DATA_SOURCE_ID: knowledgeBaseDataSource.attrDataSourceId,
      },
      handler: "handler",
      logRetention: logs.RetentionDays.ONE_MONTH,
      memorySize: 2048,
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(15),
    });
    ingestionFunction.addEventSource(new lambdaEventSources.SqsEventSource(documentQueue, {
      batchSize: 1,
    }));

    new cloudwatch.Alarm(this, "ApiFunctionErrorsAlarm", {
      alarmDescription: "SmartStudy API Lambda returned one or more errors.",
      evaluationPeriods: 1,
      metric: apiFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
    });
    new cloudwatch.Alarm(this, "DocumentIngestionErrorsAlarm", {
      alarmDescription: "SmartStudy document-ingestion Lambda returned one or more errors.",
      evaluationPeriods: 1,
      metric: ingestionFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
    });
    new cloudwatch.Alarm(this, "DocumentProcessingDlqMessagesAlarm", {
      alarmDescription: "A document-processing message requires investigation in the DLQ.",
      evaluationPeriods: 1,
      metric: documentDlq.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
    });

    const dataTables = [
      attemptsTable, conversationsTable, conversationMessagesTable,
      documentChunksTable, documentsTable, examsTable, quizzesTable, summariesTable,
    ];
    for (const table of dataTables) {
      table.grantReadWriteData(apiFunction);
    }
    documentsTable.grantReadWriteData(ingestionFunction);
    documentChunksTable.grantReadWriteData(ingestionFunction);
    documentsBucket.grantReadWrite(apiFunction);
    documentsBucket.grantReadWrite(ingestionFunction);
    documentQueue.grantSendMessages(apiFunction);
    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:Retrieve"],
      resources: ["*"],
    }));
    ingestionFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"],
      resources: ["*"],
    }));
    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ["cognito-idp:InitiateAuth", "cognito-idp:RevokeToken", "cognito-idp:SignUp"],
      resources: [userPool.userPoolArn],
    }));
    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ["ssm:GetParameter"],
      resources: [
        `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/smartstudy/${suffix}/gemini-api-key`,
      ],
    }));
    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowOrigins: [frontendOrigin],
        maxAge: cdk.Duration.minutes(10),
      },
    });
    httpApi.addRoutes({
      integration: new apigatewayv2Integrations.HttpLambdaIntegration("ApiIntegration", apiFunction),
      methods: [apigatewayv2.HttpMethod.ANY],
      path: "/{proxy+}",
    });

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
    new cdk.CfnOutput(this, "KnowledgeBaseDataSourceId", {
      value: knowledgeBaseDataSource.attrDataSourceId,
    });
    new cdk.CfnOutput(this, "QuizzesTableName", { value: quizzesTable.tableName });
    new cdk.CfnOutput(this, "ExamsTableName", { value: examsTable.tableName });
    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
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
