import type { Readable } from "node:stream";

import {
  BedrockAgentClient,
  GetIngestionJobCommand,
  StartIngestionJobCommand,
} from "@aws-sdk/client-bedrock-agent";

import type { IStorageProvider } from "../../ports/index.js";
import type { DocumentConfig } from "./document-config.js";
import type { IDocumentRepository } from "./document-repository.js";
import { DocumentProcessingPermanentError } from "./document-processing-service.js";
import type { ProcessDocumentJob } from "./document-service.js";
import { type IPdfTextExtractor, planDocumentChunks } from "./pdf-processing.js";

export interface BedrockDocumentIngestionConfig {
  readonly dataSourceId: string;
  readonly knowledgeBaseId: string;
  readonly pollIntervalMilliseconds: number;
  readonly region: string;
  readonly timeoutMilliseconds: number;
}

interface BedrockAgentPort {
  send(command: StartIngestionJobCommand | GetIngestionJobCommand): Promise<unknown>;
}

/** Creates KB filter metadata, starts an S3 data-source sync, and waits for it. */
export class BedrockDocumentIngestionService {
  private readonly client: BedrockAgentPort;

  constructor(
    private readonly repository: IDocumentRepository,
    private readonly storage: IStorageProvider,
    private readonly extractor: IPdfTextExtractor,
    private readonly documentConfig: DocumentConfig,
    private readonly config: BedrockDocumentIngestionConfig,
    dependencies: {
      readonly client?: BedrockAgentPort;
      readonly sleep?: (milliseconds: number) => Promise<void>;
    } = {},
  ) {
    this.client = dependencies.client ?? new BedrockAgentClient({ region: config.region });
    this.sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  private readonly sleep: (milliseconds: number) => Promise<void>;

  async process(input: ProcessDocumentJob): Promise<void> {
    const document = await this.repository.findOwnedById(input.documentId, input.userId);
    if (!document) throw new DocumentProcessingPermanentError("Document was not found");
    if (document.status === "ready") return;
    if (document.status !== "processing" || document.fileKey !== input.fileKey) {
      throw new DocumentProcessingPermanentError("Document is not eligible for Bedrock ingestion");
    }

    const pdf = await this.readPdf(document.fileKey);
    const plan = planDocumentChunks(await this.extractor.extract(pdf), this.documentConfig);
    await this.storage.upload({
      body: Buffer.from(JSON.stringify({
        metadataAttributes: { documentId: document.id, userId: document.userId },
      })),
      contentType: "application/json",
      key: `${document.fileKey}.metadata.json`,
    });

    const started = await this.client.send(new StartIngestionJobCommand({
      dataSourceId: this.config.dataSourceId,
      knowledgeBaseId: this.config.knowledgeBaseId,
    })) as { ingestionJob?: { ingestionJobId?: string } };
    const jobId = started.ingestionJob?.ingestionJobId;
    if (!jobId) throw new Error("Bedrock did not return an ingestion job ID");
    await this.waitForCompletion(jobId);

    const changed = await this.repository.replaceChunksAndMarkReady({
      chapters: plan.chapters,
      chunks: plan.chunks,
      documentId: document.id,
      pageCount: plan.pageCount,
      userId: document.userId,
    });
    if (!changed) throw new DocumentProcessingPermanentError("Document was changed while it was being indexed");
  }

  private async readPdf(key: string): Promise<Uint8Array> {
    const stream = await this.storage.download(key);
    const buffers: Buffer[] = [];
    let length = 0;
    for await (const chunk of stream as Readable) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      length += buffer.byteLength;
      if (length > this.documentConfig.maxFileSizeBytes) {
        throw new DocumentProcessingPermanentError("PDF exceeds the configured maximum size");
      }
      buffers.push(buffer);
    }
    return Buffer.concat(buffers);
  }

  private async waitForCompletion(ingestionJobId: string): Promise<void> {
    const deadline = Date.now() + this.config.timeoutMilliseconds;
    while (Date.now() < deadline) {
      const response = await this.client.send(new GetIngestionJobCommand({
        dataSourceId: this.config.dataSourceId,
        ingestionJobId,
        knowledgeBaseId: this.config.knowledgeBaseId,
      })) as { ingestionJob?: { failureReasons?: readonly string[]; status?: string } };
      const status = response.ingestionJob?.status;
      if (status === "COMPLETE") return;
      if (status === "FAILED" || status === "STOPPED") {
        throw new Error(`Bedrock ingestion ${status.toLowerCase()}: ${(response.ingestionJob?.failureReasons ?? []).join("; ")}`);
      }
      await this.sleep(this.config.pollIntervalMilliseconds);
    }
    throw new Error("Timed out waiting for Bedrock Knowledge Base ingestion");
  }
}
