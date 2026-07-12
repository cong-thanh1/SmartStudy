import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  type RetrieveCommandInput,
} from "@aws-sdk/client-bedrock-agent-runtime";

import type {
  IVectorStore,
  VectorRecord,
  VectorSearchQuery,
  VectorSearchResult,
} from "../../ports/index.js";
import type { BedrockKnowledgeBaseConfig } from "./bedrock-knowledge-base-config.js";

interface BedrockAgentRuntimePort {
  send(command: RetrieveCommand): Promise<unknown>;
}

/**
 * Read-only RAG adapter for a Bedrock Knowledge Base backed by S3 Vectors.
 * Ingestion is deliberately performed by the document-ingestion Lambda; a KB
 * cannot safely accept pgvector-style direct embedding writes.
 */
export class BedrockKnowledgeBaseStore implements IVectorStore {
  private readonly client: BedrockAgentRuntimePort;

  constructor(
    private readonly config: BedrockKnowledgeBaseConfig,
    dependencies: { readonly client?: BedrockAgentRuntimePort } = {},
  ) {
    this.client = dependencies.client ?? new BedrockAgentRuntimeClient({ region: config.region });
  }

  async deleteByDocument(): Promise<void> {
    throw new Error("Bedrock Knowledge Base documents must be removed through its S3 data source ingestion workflow");
  }

  async upsertEmbeddings(records: readonly VectorRecord[]): Promise<void> {
    void records;
    throw new Error("Bedrock Knowledge Base does not support direct embedding upserts");
  }

  async similaritySearch(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const queryText = query.queryText?.trim();
    if (!queryText) {
      throw new RangeError("queryText is required for Bedrock Knowledge Base retrieval");
    }

    const input: RetrieveCommandInput = {
      knowledgeBaseId: this.config.knowledgeBaseId,
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          filter: {
            andAll: [
              { equals: { key: "userId", value: query.userId } },
              { equals: { key: "documentId", value: query.documentId } },
            ],
          },
          numberOfResults: query.topK ?? this.config.topK,
        },
      },
      retrievalQuery: { text: queryText },
    };
    const response = await this.client.send(new RetrieveCommand(input)) as RetrieveResponse;

    return (response.retrievalResults ?? [])
      .filter((result) => typeof result.content?.text === "string")
      .map((result, index) => toSearchResult(result, query.documentId, index));
  }
}

interface RetrieveResponse {
  readonly retrievalResults?: readonly RetrievalResult[];
}

interface RetrievalResult {
  readonly content?: { readonly text?: string };
  readonly location?: { readonly s3Location?: { readonly uri?: string } };
  readonly metadata?: Record<string, unknown>;
  readonly score?: number;
}

function toSearchResult(
  result: RetrievalResult,
  documentId: string,
  index: number,
): VectorSearchResult {
  const metadata = result.metadata ?? {};
  const pageEnd = toPage(metadata.pageEnd);
  const pageStart = toPage(metadata.pageStart);
  return {
    documentId,
    id: typeof metadata.chunkId === "string" ? metadata.chunkId : `${result.location?.s3Location?.uri ?? documentId}#${index}`,
    similarity: typeof result.score === "number" && Number.isFinite(result.score) ? result.score : 0,
    text: result.content?.text ?? "",
    ...(typeof metadata.chapterTitle === "string" ? { chapterTitle: metadata.chapterTitle } : {}),
    ...(pageEnd === undefined ? {} : { pageEnd }),
    ...(pageStart === undefined ? {} : { pageStart }),
  };
}

function toPage(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
