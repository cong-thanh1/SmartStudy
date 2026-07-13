import type { IVectorStore, VectorRecord, VectorSearchQuery, VectorSearchResult } from "../../ports/index.js";
import type { IDocumentRepository } from "../../modules/documents/document-repository.js";

/**
 * A dependency-free RAG fallback while Bedrock Knowledge Bases are unavailable.
 * Chunks remain private because the repository verifies document ownership first.
 */
export class DynamoDbChunkStore implements IVectorStore {
  constructor(private readonly documents: IDocumentRepository) {}

  async deleteByDocument(): Promise<void> {
    throw new Error("DynamoDB document chunks are deleted through the document repository");
  }

  async upsertEmbeddings(_records: readonly VectorRecord[]): Promise<void> {
    throw new Error("DynamoDB document chunks are written by document ingestion");
  }

  async similaritySearch(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const terms = tokenize(query.queryText ?? "");
    if (terms.length === 0) throw new RangeError("queryText is required for DynamoDB chunk retrieval");

    const chunks = await this.documents.listChunks({
      documentId: query.documentId,
      userId: query.userId,
    });
    return chunks
      .map((chunk) => ({ chunk, score: score(chunk.chunkText, terms) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id))
      .slice(0, query.topK ?? 5)
      .map(({ chunk, score: similarity }) => ({
        ...(chunk.chapterTitle === null ? {} : { chapterTitle: chunk.chapterTitle }),
        documentId: query.documentId,
        id: chunk.id,
        ...(chunk.pageEnd === null ? {} : { pageEnd: chunk.pageEnd }),
        ...(chunk.pageStart === null ? {} : { pageStart: chunk.pageStart }),
        similarity,
        text: chunk.chunkText,
      }));
  }
}

function tokenize(text: string): readonly string[] {
  return [...new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])];
}

function score(text: string, terms: readonly string[]): number {
  const haystack = text.toLocaleLowerCase();
  return terms.reduce(
    (total, term) => total + haystack.split(term).length - 1,
    0,
  );
}
