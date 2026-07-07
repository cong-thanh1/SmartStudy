-- CreateTable
CREATE TABLE "exams" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "num_questions" INTEGER NOT NULL,
    "time_limit_minutes" INTEGER,
    "difficulty_distribution" JSONB,
    "questions" JSONB NOT NULL,
    "answer_key" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exams_num_questions_check" CHECK ("num_questions" > 0),
    CONSTRAINT "exams_questions_check" CHECK (jsonb_typeof("questions") = 'array'),
    CONSTRAINT "exams_answer_key_check" CHECK (jsonb_typeof("answer_key") = 'array')
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "exam_id" UUID,
    "quiz_id" UUID,
    "user_id" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DECIMAL(10,2),
    "max_score" DECIMAL(10,2),
    "detailed_result" JSONB,
    "ai_feedback" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exam_attempts_answers_check" CHECK (jsonb_typeof("answers") = 'array' OR jsonb_typeof("answers") = 'object')
);

-- CreateIndex
CREATE INDEX "idx_exams_document" ON "exams"("document_id");

-- CreateIndex
CREATE INDEX "idx_exams_user" ON "exams"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_exam_attempts_exam" ON "exam_attempts"("exam_id");

-- CreateIndex
CREATE INDEX "idx_exam_attempts_quiz" ON "exam_attempts"("quiz_id");

-- CreateIndex
CREATE INDEX "idx_exam_attempts_user" ON "exam_attempts"("user_id", "submitted_at" DESC);

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
