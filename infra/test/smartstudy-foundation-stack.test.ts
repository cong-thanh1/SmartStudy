import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import { SmartStudyFoundationStack } from "../lib/smartstudy-foundation-stack.js";

describe("SmartStudyFoundationStack", () => {
  it("creates the active API, ingestion, auth, queue, and DynamoDB infrastructure", () => {
    const app = new cdk.App();
    const stack = new SmartStudyFoundationStack(app, "TestStack", {
      environment: "test",
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.resourceCountIs("AWS::SQS::Queue", 2);
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
    template.resourceCountIs("AWS::Lambda::Function", 3);
    template.resourceCountIs("AWS::Logs::LogGroup", 2);
    template.resourceCountIs("AWS::DynamoDB::Table", 9);
    template.resourceCountIs("AWS::Bedrock::KnowledgeBase", 0);
    template.resourceCountIs("AWS::Bedrock::DataSource", 0);
    template.resourceCountIs("AWS::S3Vectors::VectorBucket", 0);
    template.resourceCountIs("AWS::S3Vectors::Index", 0);
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.resourceCountIs("AWS::CloudWatch::Alarm", 3);
    template.hasResourceProperties("AWS::SQS::Queue", {
      ReceiveMessageWaitTimeSeconds: 20,
      VisibilityTimeout: 900,
    });
  }, 30_000);

  it("allows every configured frontend origin in API and upload CORS", () => {
    const app = new cdk.App();
    const frontendOrigins = [
      "https://staging.example.com",
      "https://app.example.com",
    ];
    const stack = new SmartStudyFoundationStack(app, "CorsTestStack", {
      environment: "production",
      frontendOrigins,
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: {
        AllowOrigins: frontendOrigins,
      },
    });
    template.hasResourceProperties("AWS::S3::Bucket", {
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedOrigins: frontendOrigins,
          },
        ],
      },
    });
  }, 30_000);
});
