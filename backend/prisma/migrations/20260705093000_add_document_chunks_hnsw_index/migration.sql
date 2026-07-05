-- CreateIndex
-- pgvector HNSW index for cosine-distance similarity search over PDF chunks.
CREATE INDEX "idx_chunks_embedding" ON "document_chunks"
  USING hnsw ("embedding" vector_cosine_ops);