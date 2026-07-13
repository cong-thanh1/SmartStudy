import * as cdk from "aws-cdk-lib";

import { SmartStudyFoundationStack } from "../lib/smartstudy-foundation-stack.js";

const app = new cdk.App();
const environment = app.node.tryGetContext("environment") ?? "dev";
const frontendOrigin = app.node.tryGetContext("frontendOrigin");
const localAiBaseUrl = app.node.tryGetContext("localAiBaseUrl");

new SmartStudyFoundationStack(app, `SmartStudy-${environment}-Foundation`, {
  environment,
  ...(typeof frontendOrigin === "string" ? { frontendOrigin } : {}),
  ...(typeof localAiBaseUrl === "string" ? { localAiBaseUrl } : {}),
});
