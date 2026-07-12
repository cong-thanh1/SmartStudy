import "dotenv/config";

import { DynamoDbDocumentRepository } from "./adapters/documents/dynamodb-document-repository.js";
import { PdfParseTextExtractor } from "./adapters/documents/pdf-parse-text-extractor.js";
import { loadDocumentConfig } from "./modules/documents/document-config.js";
import { BedrockDocumentIngestionService } from "./modules/documents/bedrock-document-ingestion-service.js";
import type { ProcessDocumentJob } from "./modules/documents/document-service.js";
import { createStorageProviderFromEnv } from "./provider-factory.js";

const service = new BedrockDocumentIngestionService(
  new DynamoDbDocumentRepository({
    chunksTableName: required("DOCUMENT_CHUNKS_TABLE_NAME"),
    documentsTableName: required("DOCUMENTS_TABLE_NAME"),
  }),
  createStorageProviderFromEnv(),
  new PdfParseTextExtractor(),
  loadDocumentConfig(),
  {
    dataSourceId: required("BEDROCK_KNOWLEDGE_BASE_DATA_SOURCE_ID"),
    knowledgeBaseId: required("BEDROCK_KNOWLEDGE_BASE_ID"),
    pollIntervalMilliseconds: 10_000,
    region: process.env.BEDROCK_REGION ?? "us-east-1",
    timeoutMilliseconds: 840_000,
  },
);

export async function handler(event: { readonly Records?: readonly { readonly body: string }[] }): Promise<void> {
  for (const record of event.Records ?? []) {
    const envelope = JSON.parse(record.body) as { data?: ProcessDocumentJob; name?: string };
    if (envelope.name !== loadDocumentConfig().processingQueue || !envelope.data) {
      throw new Error("Invalid document-processing SQS message");
    }
    await service.process(envelope.data);
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
