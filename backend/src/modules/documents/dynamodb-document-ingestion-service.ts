import type { Readable } from "node:stream";

import type { IStorageProvider } from "../../ports/index.js";
import type { DocumentConfig } from "./document-config.js";
import type { IDocumentRepository } from "./document-repository.js";
import { DocumentProcessingPermanentError } from "./document-processing-service.js";
import type { ProcessDocumentJob } from "./document-service.js";
import { type IPdfTextExtractor, planDocumentChunks } from "./pdf-processing.js";

/** Extracts private PDF chunks into DynamoDB without requiring Bedrock. */
export class DynamoDbDocumentIngestionService {
  constructor(
    private readonly repository: IDocumentRepository,
    private readonly storage: IStorageProvider,
    private readonly extractor: IPdfTextExtractor,
    private readonly config: DocumentConfig,
  ) {}

  async process(input: ProcessDocumentJob): Promise<void> {
    const document = await this.repository.findOwnedById(input.documentId, input.userId);
    if (!document) throw new DocumentProcessingPermanentError("Document was not found");
    if (document.status === "ready") return;
    if (document.status !== "processing" || document.fileKey !== input.fileKey) {
      throw new DocumentProcessingPermanentError("Document is not eligible for DynamoDB ingestion");
    }

    const plan = planDocumentChunks(await this.extractor.extract(await this.readPdf(document.fileKey)), this.config);
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
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of stream as Readable) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      length += buffer.byteLength;
      if (length > this.config.maxFileSizeBytes) {
        throw new DocumentProcessingPermanentError("PDF exceeds the configured maximum size");
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }
}
