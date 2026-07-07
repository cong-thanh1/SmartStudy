-- CreateTable
CREATE TABLE "summaries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "chapter_ref" VARCHAR(500),
    "summary_text" TEXT NOT NULL,
    "key_points" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "summaries_scope_check" CHECK (
        "scope" IN ('full', 'chapter')
    ),
    CONSTRAINT "summaries_summary_text_check" CHECK (
        btrim("summary_text") <> ''
    ),
    CONSTRAINT "summaries_key_points_check" CHECK (
        jsonb_typeof("key_points") = 'array'
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "summaries_document_id_scope_chapter_ref_key"
ON "summaries"("document_id", "scope", "chapter_ref") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "idx_summaries_document"
ON "summaries"("document_id");

-- AddForeignKey
ALTER TABLE "summaries"
ADD CONSTRAINT "summaries_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "documents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
