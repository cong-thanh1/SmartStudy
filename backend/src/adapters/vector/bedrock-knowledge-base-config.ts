import { z } from "zod";

const environmentSchema = z.object({
  BEDROCK_KNOWLEDGE_BASE_ID: z.string().trim().min(1),
  BEDROCK_REGION: z.string().trim().min(1).default("us-east-1"),
  BEDROCK_KNOWLEDGE_BASE_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
});

export interface BedrockKnowledgeBaseConfig {
  readonly knowledgeBaseId: string;
  readonly region: string;
  readonly topK: number;
}

export function loadBedrockKnowledgeBaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): BedrockKnowledgeBaseConfig {
  const parsed = environmentSchema.parse(environment);
  return {
    knowledgeBaseId: parsed.BEDROCK_KNOWLEDGE_BASE_ID,
    region: parsed.BEDROCK_REGION,
    topK: parsed.BEDROCK_KNOWLEDGE_BASE_TOP_K,
  };
}
