-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "difficulty" VARCHAR(20),
    "questions" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quizzes_difficulty_check" CHECK (
        "difficulty" IS NULL OR "difficulty" IN ('easy', 'medium', 'hard')
    ),
    CONSTRAINT "quizzes_questions_check" CHECK (
        jsonb_typeof("questions") = 'array'
    )
);

-- CreateIndex
CREATE INDEX "idx_quizzes_document" ON "quizzes"("document_id");

-- CreateIndex
CREATE INDEX "idx_quizzes_user" ON "quizzes"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "quizzes"
ADD CONSTRAINT "quizzes_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "documents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes"
ADD CONSTRAINT "quizzes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
