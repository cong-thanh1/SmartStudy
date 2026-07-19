import * as cdk from "aws-cdk-lib";

import { SmartStudyFoundationStack } from "../lib/smartstudy-foundation-stack.js";

const app = new cdk.App();
const environment = app.node.tryGetContext("environment") ?? "dev";
const frontendOrigin = app.node.tryGetContext("frontendOrigin");
const frontendOrigins = parseFrontendOrigins(
  app.node.tryGetContext("frontendOrigins"),
);
const localAiBaseUrl = app.node.tryGetContext("localAiBaseUrl");

new SmartStudyFoundationStack(app, `SmartStudy-${environment}-Foundation`, {
  environment,
  ...(frontendOrigins ? { frontendOrigins } : {}),
  ...(typeof frontendOrigin === "string" ? { frontendOrigin } : {}),
  ...(typeof localAiBaseUrl === "string" ? { localAiBaseUrl } : {}),
});

function parseFrontendOrigins(value: unknown): readonly string[] | undefined {
  const origins = Array.isArray(value)
    ? value.filter((origin): origin is string => typeof origin === "string")
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = [...new Set(origins.map((origin) => origin.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}
