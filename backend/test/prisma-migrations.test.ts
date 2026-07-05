import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Prisma migrations", () => {
  it("adds an HNSW cosine index for document chunk embeddings", () => {
    const migrationSql = readFileSync(
      new URL(
        "../prisma/migrations/20260705093000_add_document_chunks_hnsw_index/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migrationSql).toContain('CREATE INDEX "idx_chunks_embedding"');
    expect(migrationSql).toContain("USING hnsw");
    expect(migrationSql).toContain('"embedding" vector_cosine_ops');
  });
});