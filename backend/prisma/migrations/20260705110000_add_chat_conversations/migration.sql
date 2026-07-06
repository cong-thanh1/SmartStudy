-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "document_id" UUID,
    "title" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversations_title_check" CHECK (
        "title" IS NULL OR btrim("title") <> ''
    )
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_role_check" CHECK (
        "role" IN ('user', 'assistant')
    ),
    CONSTRAINT "messages_content_check" CHECK (
        btrim("content") <> ''
    ),
    CONSTRAINT "messages_citations_check" CHECK (
        jsonb_typeof("citations") = 'array'
    )
);

-- CreateIndex
CREATE INDEX "idx_conversations_user"
ON "conversations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_conversations_document"
ON "conversations"("document_id");

-- CreateIndex
CREATE INDEX "idx_messages_conversation"
ON "messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "documents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages"
ADD CONSTRAINT "messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
