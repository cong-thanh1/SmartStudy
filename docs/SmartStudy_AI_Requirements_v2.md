# SmartStudy AI — Đặc tả kỹ thuật v2 (Local-first, sẵn sàng tích hợp AWS)

**Thay đổi so với v1:** Triển khai trước **không dùng AWS**, chạy hoàn toàn local (Docker Compose). Toàn bộ phần phụ thuộc AWS được bọc qua interface (ports & adapters) để sau này chỉ cần viết thêm 1 adapter, không sửa logic nghiệp vụ đã có.

**Tech stack cập nhật:**
- Frontend: ReactJS + Tailwind CSS + Axios
- Backend: Node.js (TypeScript) + Express/Fastify, RESTful API
- Database: **PostgreSQL** (thay DynamoDB) — dùng luôn được cho cả local và AWS RDS/Aurora sau này, không cần đổi
- Vector store cho RAG: **pgvector** (extension của Postgres) — không cần OpenSearch/Bedrock KB ngay từ đầu
- AI: RAG + LLM, ban đầu gọi trực tiếp Anthropic API (hoặc OpenAI, tuỳ bạn chọn), sau này thay bằng Amazon Bedrock qua adapter

> **Giả định mình đặt ra (nói rõ để bạn điều chỉnh nếu sai):** dùng LLM provider mặc định cho giai đoạn local là gọi trực tiếp Anthropic API (cùng họ model Claude sẽ có trên Bedrock), để khi migrate sang Bedrock, prompt/logic gần như không đổi, chỉ đổi cách gọi API. Nếu bạn muốn dùng OpenAI hoặc model local (Ollama) thay vào, chỉ cần viết thêm 1 adapter khác — kiến trúc không phụ thuộc lựa chọn này.

---

## 1. Nguyên tắc kiến trúc: Ports & Adapters (Hexagonal)

Đây là nguyên tắc **quan trọng nhất** của toàn bộ đặc tả — agent phải tuân thủ tuyệt đối để việc "sau này tích hợp AWS" thực sự dễ dàng, không phải viết lại.

**Luật:** Code nghiệp vụ (services, controllers, use-cases) **không được** gọi trực tiếp bất kỳ SDK cụ thể nào (không `fs` để lưu file, không gọi thẳng Anthropic SDK, không gọi thẳng `pg` để lưu file nhị phân...). Mọi thứ đi qua **interface (port)**, và có **adapter cụ thể** implement interface đó.

### 1.1 Danh sách Port cần định nghĩa

| Port (interface) | Method chính | Adapter local (bây giờ) | Adapter AWS (tương lai) |
|---|---|---|---|
| `IStorageProvider` | `upload()`, `getDownloadUrl()`, `delete()` | `S3CompatibleStorageProvider` → chạy chống **MinIO** (self-hosted, S3 API tương thích 100%) | Cùng 1 class, chỉ đổi endpoint/credentials sang **Amazon S3** thật |
| `IVectorStore` | `upsertEmbeddings()`, `similaritySearch()` | `PgVectorStore` (Postgres + extension `pgvector`) | Giữ nguyên `PgVectorStore` nếu Postgres chạy trên **RDS/Aurora PostgreSQL có pgvector**; hoặc thêm `BedrockKnowledgeBaseStore` nếu muốn dùng Bedrock KB |
| `ILLMProvider` | `generateText()`, `generateStructuredJSON()` | `AnthropicLLMProvider` (gọi Anthropic API trực tiếp) | `BedrockLLMProvider` (gọi Bedrock Converse API, cùng model Claude) |
| `IEmbeddingProvider` | `embed(text): number[]` | `AnthropicOrLocalEmbeddingProvider` (hoặc Voyage AI / OpenAI embeddings) | `BedrockEmbeddingProvider` (Titan/Cohere Embeddings qua Bedrock) |
| `IAuthProvider` | `register()`, `login()`, `verifyToken()` | `JwtAuthProvider` (bcrypt + jsonwebtoken, tự quản lý user trong Postgres) | `CognitoAuthProvider` (Amazon Cognito) — **hoặc giữ JWT tự viết luôn nếu không cần Cognito** |
| `IQueueProvider` | `enqueue()`, `consume()` | `RedisQueueProvider` (BullMQ + Redis, chạy trong Docker Compose) | `SqsQueueProvider` (Amazon SQS) |
| `IEmailProvider` | `sendVerificationEmail()` | `SmtpEmailProvider` (Nodemailer + Mailtrap/SMTP giả lập) | `SesEmailProvider` (Amazon SES) |

### 1.2 Cách chọn adapter — Dependency Injection theo config

```
# .env (local)
STORAGE_PROVIDER=s3-compatible   # cùng giá trị khi lên AWS
STORAGE_ENDPOINT=http://localhost:9000   # MinIO local
STORAGE_ENDPOINT=                         # để trống / bỏ dòng này khi dùng AWS S3 thật

LLM_PROVIDER=anthropic     # sau này đổi thành "bedrock"
VECTOR_STORE=pgvector      # giữ nguyên khi lên AWS nếu dùng RDS+pgvector
AUTH_PROVIDER=jwt          # sau này có thể đổi thành "cognito"
QUEUE_PROVIDER=redis       # sau này đổi thành "sqs"
EMAIL_PROVIDER=smtp        # sau này đổi thành "ses"
```

Một `ProviderFactory` (module duy nhất) đọc biến env này và trả về instance adapter tương ứng. **Đây là nơi DUY NHẤT trong codebase được phép biết sự khác biệt giữa local và AWS.** Toàn bộ phần còn lại của backend chỉ import interface, không import adapter trực tiếp.

```
backend/src/
  ports/
    IStorageProvider.ts
    IVectorStore.ts
    ILLMProvider.ts
    IEmbeddingProvider.ts
    IAuthProvider.ts
    IQueueProvider.ts
    IEmailProvider.ts
  adapters/
    storage/S3CompatibleStorageProvider.ts
    vector/PgVectorStore.ts
    llm/AnthropicLLMProvider.ts
    llm/BedrockLLMProvider.ts        (viết ở phase migration)
    auth/JwtAuthProvider.ts
    queue/RedisQueueProvider.ts
    email/SmtpEmailProvider.ts
  provider-factory.ts    ← điểm duy nhất chọn adapter theo env
  modules/
    documents/
    chat/
    summary/
    quiz/
    exam/
    grading/
    tutor/
    auth/
```

### 1.3 Vì sao chọn MinIO cho storage (quan trọng)
MinIO expose đúng **S3 API**. Nghĩa là code `S3CompatibleStorageProvider` viết bằng **AWS SDK v3 cho S3** (`@aws-sdk/client-s3`) ngay từ đầu — chỉ trỏ endpoint về `localhost:9000` lúc dev. Khi lên AWS thật, xoá biến `STORAGE_ENDPOINT` (hoặc đổi thành endpoint AWS chuẩn), đổi credentials — **không sửa 1 dòng code nào**. Đây là adapter duy nhất có thể "zero-code-change" khi migrate.

### 1.4 Vì sao chọn pgvector thay vì tự dựng vector DB riêng
- Không cần thêm hạ tầng (Elasticsearch/OpenSearch/Qdrant...) ở giai đoạn local — giảm độ phức tạp Docker Compose.
- Khi lên AWS, **RDS for PostgreSQL và Aurora PostgreSQL đều hỗ trợ pgvector** → migrate database chỉ là dump/restore, vector store không cần đổi kiến trúc.
- Nếu sau này cần scale lớn hơn hoặc muốn dùng Bedrock Knowledge Base có sẵn (ingestion tự động, không cần tự quản lý chunking), agent viết thêm `BedrockKnowledgeBaseStore` implement cùng `IVectorStore` — service RAG ở trên không biết gì đã đổi.

---

## 2. Kiến trúc tổng quan (local, Docker Compose)

```
[React SPA] ──HTTP──> [Node.js API (Express/Fastify)] ──> Postgres (+pgvector)
                              │                              │
                              ├──> MinIO (S3-compatible)      │
                              ├──> Redis (BullMQ queue)       │
                              └──> Anthropic API (LLM/Embed)  │
                                                               │
                        (worker process riêng, đọc queue Redis, xử lý PDF)
```

**docker-compose.yml (thành phần chính):**
- `postgres` (image `pgvector/pgvector:pg16` — đã cài sẵn extension)
- `minio` (+ `minio/mc` để tạo bucket lúc khởi tạo)
- `redis`
- `api` (Node.js app)
- `worker` (Node.js process riêng chạy BullMQ consumer, xử lý PDF nặng — tách khỏi API để không block request)
- (tuỳ chọn) `mailtrap`/`maildev` để test email verification local

---

## 3. Database schema — PostgreSQL (DDL chính)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'student',   -- 'student' | 'admin'
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  file_key VARCHAR(500) NOT NULL,        -- key trong storage (MinIO/S3)
  status VARCHAR(20) NOT NULL DEFAULT 'uploading', -- uploading|processing|ready|failed
  page_count INT,
  size_bytes BIGINT,
  chapters JSONB DEFAULT '[]',            -- [{chapter_title, start_page, end_page}]
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_documents_user ON documents(user_id, created_at DESC);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chapter_title VARCHAR(500),
  page_start INT,
  page_end INT,
  embedding VECTOR(1024),   -- số chiều tuỳ model embedding đang dùng, xem mục 3.1
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);
-- Index HNSW cho similarity search (pgvector >= 0.5)
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE, -- NULL nếu là hội thoại module tutor (mục 5.7)
  title VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,          -- user | assistant
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',       -- [{document_id, page, snippet}]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  scope VARCHAR(20) NOT NULL,         -- full | chapter
  chapter_ref VARCHAR(500),
  summary_text TEXT NOT NULL,
  key_points JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, scope, chapter_ref)   -- dùng cho cache, tránh tính lại
);

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty VARCHAR(20),
  questions JSONB NOT NULL,   -- [{question_id, question_text, options[4], correct_answer, explanation}]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  num_questions INT NOT NULL,
  time_limit_minutes INT,
  difficulty_distribution JSONB,   -- {easy: 40, medium: 40, hard: 20}
  questions JSONB NOT NULL,        -- không kèm đáp án khi trả cho FE lúc "take"
  answer_key JSONB NOT NULL,       -- tách riêng, chỉ dùng lúc chấm
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score NUMERIC,
  max_score NUMERIC,
  detailed_result JSONB,
  ai_feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.1 Lưu ý về số chiều embedding
Số chiều `VECTOR(n)` phụ thuộc model embedding đang dùng (ví dụ Voyage AI ~1024, OpenAI `text-embedding-3-small` = 1536, Titan Embeddings v2 trên Bedrock = 1024). **Chốt số chiều trước khi tạo migration đầu tiên** — đổi model embedding sau này đồng nghĩa phải re-embed toàn bộ dữ liệu cũ (viết migration script riêng, không thể chỉ đổi cột).

### 3.2 ORM
Dùng **Prisma** (khuyến nghị) hoặc Drizzle ORM cho type-safety + migration tool có sẵn. Prisma hỗ trợ tốt cho Postgres; với cột `VECTOR` cần dùng raw SQL query (`$queryRaw`) cho phần similarity search vì Prisma chưa có type built-in cho pgvector.

---

## 4. RAG Pipeline (chi tiết, chạy hoàn toàn local)

1. **Upload:** FE lấy presigned URL từ API (`S3CompatibleStorageProvider.getUploadUrl()`, MinIO SDK) → upload PDF trực tiếp lên MinIO.
2. **Enqueue xử lý:** API tạo record `documents` (status=`processing`) → đẩy job vào Redis queue (BullMQ) qua `IQueueProvider`.
3. **Worker xử lý** (process Node.js riêng, không chung với API để không block request):
   - Tải file từ MinIO.
   - Extract text bằng `pdf-parse` hoặc `pdfjs-dist`.
   - Phát hiện chương/mục: heuristic theo font-size/heading pattern, hoặc gọi LLM 1 lần để agent tự phân đoạn ("đây là mục lục/cấu trúc chương của tài liệu này, trả JSON").
   - Chunk text (theo độ dài ~500-800 token, có overlap 50-100 token) → gắn `chapter_title`, `page_start/end` cho mỗi chunk.
   - Gọi `IEmbeddingProvider.embed()` cho từng chunk → lưu vào `document_chunks.embedding`.
   - Update `documents.status = ready` (hoặc `failed` + lý do lưu log).
4. **Truy vấn (chat/summary/quiz):**
   - Embed câu hỏi/query → `PgVectorStore.similaritySearch()` dùng cú pháp:
     ```sql
     SELECT chunk_text, chapter_title, page_start, page_end,
            1 - (embedding <=> $1) AS similarity
     FROM document_chunks
     WHERE document_id = $2
     ORDER BY embedding <=> $1
     LIMIT 5;
     ```
   - Ghép các chunk liên quan vào context → gọi `ILLMProvider.generateText()` với system prompt bắt buộc chỉ trả lời dựa trên context, kèm citation `{document_id, page, snippet}`.

**Ràng buộc bảo mật dữ liệu (bắt buộc test):** mọi query vector search PHẢI filter theo `document_id` thuộc sở hữu `user_id` hiện tại (join/subquery kiểm tra ownership trước khi search) — không filter chỉ bằng `document_id` truyền từ client.

---

## 5. Yêu cầu chức năng theo module

*(Giữ nguyên nội dung nghiệp vụ như bản v1, chỉ đổi endpoint/tầng lưu trữ cho khớp Postgres. Tóm tắt lại các điểm khác biệt kỹ thuật cần chú ý — chi tiết đầy đủ acceptance criteria xem lại bản v1, áp dụng tương tự với DB mới.)*

| Module | Khác biệt kỹ thuật so với bản v1 (DynamoDB → Postgres) |
|---|---|
| 1. Auth | `JwtAuthProvider`: bcrypt hash password lưu trong `users.password_hash`; JWT payload có shape giống Cognito claims (`sub`, `email`, `role`) để sau này đổi sang Cognito, middleware xác thực không cần sửa nhiều |
| 2. Documents | List/search dùng `WHERE user_id = ? AND title ILIKE '%...%'` — Postgres full-text search (`tsvector`) nếu cần search nâng cao hơn ILIKE |
| 3. Chat RAG | Similarity search bằng pgvector thay Bedrock KB Retrieve API — logic retrieval nằm trong service, không phải managed service |
| 4. Summary | Cache bằng UNIQUE constraint `(document_id, scope, chapter_ref)` trong Postgres thay vì key DynamoDB |
| 5. Quiz | Lưu `questions` dạng JSONB — validate bằng Zod schema trước khi insert |
| 6. Exam | Tách `questions` (không đáp án) và `answer_key` (JSONB riêng) — query khác nhau tuỳ mode `take` vs `review` |
| 7. Grading | Chấm trắc nghiệm = so sánh JS thuần (so `answers` với `answer_key`), không dùng LLM cho phần chấm đúng/sai |
| 8. Tutor | Không dùng `document_id` filter, gọi `ILLMProvider` trực tiếp không qua `IVectorStore` |

---

## 6. Yêu cầu phi chức năng

| Nhóm | Yêu cầu (bản local-first) |
|---|---|
| Bảo mật | Password hash bcrypt (cost ≥ 12); JWT access token TTL ngắn (15-30 phút) + refresh token TTL dài hơn lưu hashed trong DB (bảng `refresh_tokens`, để có thể revoke) |
| Hiệu năng | Similarity search pgvector với HNSW index; giới hạn top-k=5 cho mỗi retrieval |
| Chi phí (dù chưa lên AWS, vẫn tốn phí gọi LLM) | Cache summary/quiz đã sinh; rate-limit số request LLM/user/phút (middleware Express) |
| Khả năng migrate | Không có `fs.readFileSync`/`fs.writeFileSync` trực tiếp cho file người dùng ở đâu ngoài adapter storage; không có raw SQL DynamoDB-style code sót lại |
| Testing | Test unit cho toàn bộ business logic phải mock qua interface (`ILLMProvider`, `IStorageProvider`...), không gọi API thật trong CI |
| Observability | Structured log (JSON, dùng `pino`) — log `request_id`, `user_id`, `provider` (để biết đang chạy local hay AWS) |

---

## 7. Setup local (Docker Compose) — checklist agent phải tạo

```yaml
# docker-compose.yml (rút gọn, agent triển khai đầy đủ)
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment: [POSTGRES_DB=smartstudy, POSTGRES_PASSWORD=...]
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment: [MINIO_ROOT_USER=..., MINIO_ROOT_PASSWORD=...]
  api:
    build: ./backend
    depends_on: [postgres, redis, minio]
    env_file: .env
  worker:
    build: ./backend
    command: node dist/worker.js
    depends_on: [postgres, redis, minio]
```

`README.md` phải có: lệnh `docker compose up -d`, lệnh chạy migration Prisma, lệnh seed dữ liệu mẫu, cách lấy Anthropic API key và set vào `.env`.

---

## 8. Sơ đồ mapping migrate AWS sau này (không code ngay, chỉ để không thiết kế sai)

| Thành phần local | Thành phần AWS tương lai | Mức độ thay đổi code |
|---|---|---|
| MinIO | Amazon S3 | Không đổi code, đổi endpoint + credentials |
| Postgres (Docker) | Amazon RDS/Aurora PostgreSQL | Không đổi schema, đổi connection string |
| pgvector trên Postgres | Giữ pgvector trên RDS, hoặc Bedrock Knowledge Base | Giữ nguyên nếu không đổi; nếu đổi sang Bedrock KB → viết adapter mới, service RAG không đổi |
| Anthropic API trực tiếp | Amazon Bedrock (Claude qua Bedrock) | Viết `BedrockLLMProvider` mới implement `ILLMProvider`, đổi `LLM_PROVIDER=bedrock` |
| BullMQ + Redis | Amazon SQS (+ Lambda hoặc ECS worker) | Viết `SqsQueueProvider` mới; nếu vẫn chạy worker Node trên ECS Fargate thì gần như không đổi logic worker |
| JWT tự viết | Giữ nguyên, hoặc Amazon Cognito | Tuỳ chọn — JWT tự viết vẫn chạy tốt trên AWS, không bắt buộc phải đổi sang Cognito |
| Node.js app (Docker) | AWS App Runner / ECS Fargate (khuyến nghị — ít refactor nhất) hoặc AWS Lambda (cần thêm adapter framework như `serverless-http`) | App Runner/Fargate: gần như copy container sang chạy, không refactor code. Lambda: cần bọc thêm handler, nhiều việc hơn |

**Khuyến nghị chiến lược migrate:** khi thật sự cần AWS, ưu tiên **containerize & lift sang ECS Fargate/App Runner** trước (giữ nguyên Express app), rồi mới xét chuyển sang Lambda nếu cần tối ưu chi phí/scale-to-zero — tránh phải viết lại toàn bộ backend theo kiểu serverless ngay từ đầu.
