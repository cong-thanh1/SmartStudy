import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import { SmartStudyFoundationStack } from "../lib/smartstudy-foundation-stack.js";

describe("SmartStudyFoundationStack", () => {
  it("creates encrypted private storage, a DLQ-backed queue, Cognito, and DynamoDB tables", () => {
    const app = new cdk.App();
    const stack = new SmartStudyFoundationStack(app, "TestStack", {
      environment: "test",
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.resourceCountIs("AWS::SQS::Queue", 2);
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
    template.resourceCountIs("AWS::Lambda::Function", 1);
    template.resourceCountIs("AWS::DynamoDB::Table", 5);
    template.hasResourceProperties("AWS::SQS::Queue", {
      ReceiveMessageWaitTimeSeconds: 20,
      VisibilityTimeout: 120,
    });
  });
});
