-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "file_key" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'uploading',
    "page_count" INTEGER,
    "size_bytes" BIGINT,
    "chapters" JSONB NOT NULL DEFAULT '[]',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "documents_title_check" CHECK (btrim("title") <> ''),
    CONSTRAINT "documents_file_key_check" CHECK (btrim("file_key") <> ''),
    CONSTRAINT "documents_status_check" CHECK (
        "status" IN ('uploading', 'processing', 'ready', 'failed')
    ),
    CONSTRAINT "documents_page_count_check" CHECK (
        "page_count" IS NULL OR "page_count" > 0
    ),
    CONSTRAINT "documents_size_bytes_check" CHECK (
        "size_bytes" IS NULL OR "size_bytes" > 0
    ),
    CONSTRAINT "documents_chapters_check" CHECK (
        jsonb_typeof("chapters") = 'array'
    )
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "chapter_title" VARCHAR(500),
    "page_start" INTEGER,
    "page_end" INTEGER,
    "embedding" vector(1024),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_chunks_text_check" CHECK (btrim("chunk_text") <> ''),
    CONSTRAINT "document_chunks_page_start_check" CHECK (
        "page_start" IS NULL OR "page_start" > 0
    ),
    CONSTRAINT "document_chunks_page_end_check" CHECK (
        "page_end" IS NULL OR "page_end" > 0
    ),
    CONSTRAINT "document_chunks_page_range_check" CHECK (
        "page_start" IS NULL
        OR "page_end" IS NULL
        OR "page_end" >= "page_start"
    )
);

-- CreateIndex
CREATE INDEX "idx_documents_user" ON "documents"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_chunks_document" ON "document_chunks"("document_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
