import type { IEmbeddingProvider } from "../../ports/index.js";

/**
 * Used with the DynamoDB lexical RAG fallback. That store deliberately does
 * not require vectors, but ChatService keeps a uniform embedding contract.
 */
export class NoOpEmbeddingProvider implements IEmbeddingProvider {
  readonly dimensions = 0;

  async embed(_text: string): Promise<number[]> {
    return [];
  }

  async embedBatch(texts: readonly string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}
