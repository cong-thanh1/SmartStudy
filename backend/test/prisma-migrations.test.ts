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

  it("adds conversation and message tables with integrity constraints", () => {
    const migrationSql = readFileSync(
      new URL(
        "../prisma/migrations/20260705110000_add_chat_conversations/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migrationSql).toContain('CREATE TABLE "conversations"');
    expect(migrationSql).toContain('CREATE TABLE "messages"');
    expect(migrationSql).toContain("messages_role_check");
    expect(migrationSql).toContain("messages_citations_check");
    expect(migrationSql).toContain('CREATE INDEX "idx_messages_conversation"');
    expect(migrationSql).toContain("ON DELETE CASCADE");
  });
});
