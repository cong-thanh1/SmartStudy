import * as cdk from "aws-cdk-lib";

import { SmartStudyFoundationStack } from "../lib/smartstudy-foundation-stack.js";

const app = new cdk.App();
const environment = app.node.tryGetContext("environment") ?? "dev";

new SmartStudyFoundationStack(app, `SmartStudy-${environment}-Foundation`, {
  environment,
});
