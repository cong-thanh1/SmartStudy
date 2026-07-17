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
    template.resourceCountIs("AWS::Lambda::Function", 4);
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
});
