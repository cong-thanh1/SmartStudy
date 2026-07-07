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

  it("adds summaries table with a unique cache constraint", () => {
    const migrationSql = readFileSync(
      new URL(
        "../prisma/migrations/20260706120000_add_summaries_table/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migrationSql).toContain('CREATE TABLE "summaries"');
    expect(migrationSql).toContain("summaries_scope_check");
    expect(migrationSql).toContain("summaries_key_points_check");
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "summaries_document_id_scope_chapter_ref_key"',
    );
    expect(migrationSql).toContain("NULLS NOT DISTINCT");
    expect(migrationSql).toContain("ON DELETE CASCADE");
  });

  it("adds quizzes table with JSON question validation", () => {
    const migrationSql = readFileSync(
      new URL(
        "../prisma/migrations/20260706130000_add_quizzes_table/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migrationSql).toContain('CREATE TABLE "quizzes"');
    expect(migrationSql).toContain('"document_id" UUID NOT NULL');
    expect(migrationSql).toContain('"user_id" UUID NOT NULL');
    expect(migrationSql).toContain('"questions" JSONB NOT NULL');
    expect(migrationSql).toContain("quizzes_difficulty_check");
    expect(migrationSql).toContain("'easy', 'medium', 'hard'");
    expect(migrationSql).toContain("quizzes_questions_check");
    expect(migrationSql).toContain("jsonb_typeof(\"questions\") = 'array'");
    expect(migrationSql).toContain('CREATE INDEX "idx_quizzes_document"');
    expect(migrationSql).toContain('CREATE INDEX "idx_quizzes_user"');
    expect(migrationSql).toContain("REFERENCES \"documents\"(\"id\")");
    expect(migrationSql).toContain("REFERENCES \"users\"(\"id\")");
    expect(migrationSql).toContain("ON DELETE CASCADE");
  });
});
