import type { IEmbeddingProvider } from "../../ports/index.js";

/**
 * Used with the DynamoDB lexical RAG fallback. That store deliberately does
 * not require vectors, but ChatService keeps a uniform embedding contract.
 */
export class NoOpEmbeddingProvider implements IEmbeddingProvider {
  readonly dimensions = 0;

  async embed(text: string): Promise<number[]> {
    void text;
    return [];
  }

  async embedBatch(texts: readonly string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}
