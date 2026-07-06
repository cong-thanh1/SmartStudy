# SmartStudy AI

Nền tảng học tập local-first sử dụng kiến trúc Ports & Adapters, sẵn sàng
thay thế hạ tầng local bằng các adapter AWS khi cần.

## Cấu trúc repository

```text
frontend/           React application
backend/            Node.js/TypeScript API và worker
docs/               Đặc tả kỹ thuật và quy ước phát triển
docker-compose.yml  Hạ tầng local
GOAL.md             Kế hoạch và trạng thái triển khai
```

## Chạy local bằng Docker Compose

Yêu cầu: Docker Engine có Compose v2.

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Trên PowerShell, dùng `Copy-Item .env.example .env` thay cho lệnh `cp`.
Trước khi chạy Compose, đặt `JWT_SECRET` trong `.env` bằng một chuỗi ngẫu nhiên
tối thiểu 32 ký tự; file mẫu cố tình để trống để không commit secret.

Các endpoint local:

- API health: <http://localhost:3000/health>
- MinIO API: <http://localhost:9000>
- MinIO Console: <http://localhost:9001>
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Storage dùng adapter S3-compatible. Khi chạy Compose, API và worker tự nhận endpoint,
bucket và credential MinIO từ các biến `MINIO_*`. Khi chạy backend trực tiếp trên
máy host, dùng nhóm biến `STORAGE_*` trong `.env.example`; nếu có
`STORAGE_ENDPOINT`, path-style access mặc định được bật để tương thích MinIO.
Trong Compose, `STORAGE_ENDPOINT` là địa chỉ nội bộ server dùng để gọi MinIO,
còn `STORAGE_PUBLIC_ENDPOINT` là địa chỉ được ký vào presigned URL cho browser.

Queue dùng BullMQ trên Redis. `QUEUE_PREFIX` tách namespace key,
`QUEUE_WORKER_CONCURRENCY` giới hạn số job xử lý đồng thời trong mỗi worker, và
worker Compose chạy thành process riêng với graceful shutdown khi nhận `SIGINT`
hoặc `SIGTERM`.

Kiểm tra nhanh:

```bash
curl http://localhost:3000/health
docker compose logs worker
```

Auth API hiện có các endpoint `POST /api/v1/auth/register`,
`POST /api/v1/auth/login`, `POST /api/v1/auth/refresh` và
`POST /api/v1/auth/logout`. Password phải có tối thiểu 12 ký tự; refresh token
được lưu dạng hash và được rotate khi gọi endpoint refresh.

Upload tài liệu dùng Bearer access token theo ba bước:

1. `POST /api/v1/documents/upload-url` với `title`, `contentType`
   (`application/pdf`) và `sizeBytes` (tối đa 50 MiB).
2. `PUT` file vào presigned URL cùng các header API trả về.
3. `POST /api/v1/documents/{documentId}/complete`; API kiểm tra metadata object,
   chuyển document sang `processing` và enqueue job xử lý.

Worker đọc queue `DOCUMENT_PROCESSING_QUEUE`, tải PDF từ storage, extract text
bằng `pdf-parse`, phát hiện heading chương cơ bản, chunk text theo
`DOCUMENT_CHUNK_MAX_TOKENS` (mặc định 700) với overlap
`DOCUMENT_CHUNK_OVERLAP_TOKENS` (mặc định 80), gọi embedding provider và lưu vào
`document_chunks`. PDF không có text extractable sẽ được đánh dấu `failed`; xử lý
thành công sẽ chuyển document sang `ready`.

Quản lý tài liệu dùng Bearer access token:

- `GET /api/v1/documents` hỗ trợ `search`, `status`, `page`, `limit`.
- `GET /api/v1/documents/{documentId}` trả metadata, số trang và danh sách chương.
- `DELETE /api/v1/documents/{documentId}` xóa object storage và soft-delete record.
Chat RAG dùng Bearer access token:

- `POST /api/v1/chat/conversations` với `documentId` của tài liệu đã `ready`.
- `POST /api/v1/chat/conversations/{conversationId}/messages` với `content`.

API embed câu hỏi, lấy tối đa 5 chunk bằng pgvector, yêu cầu LLM chỉ trả lời từ
context và trả citations `{documentId, page, snippet}` được dựng trực tiếp từ
các chunk truy xuất. Conversation và cặp user/assistant message được lưu trong
Postgres. Cấu hình `ANTHROPIC_API_KEY` để sinh câu trả lời; nếu chưa cấu hình,
API khác vẫn hoạt động và endpoint gửi message trả `503 PROVIDER_NOT_CONFIGURED`.

Dừng service nhưng giữ dữ liệu:

```bash
docker compose down
```

Chỉ dùng `docker compose down -v` khi chủ động muốn xoá toàn bộ dữ liệu local.

## Backend

```bash
cd backend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Chạy migration và seed tài khoản mẫu:

```bash
cd backend
npm run prisma:migrate:deploy
npm run prisma:seed
```

Trước khi seed, đặt `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` và
`SEED_USER_FULL_NAME` trong `.env`. Seed từ chối chạy nếu password trống hoặc
ngắn hơn 12 ký tự.

API key Anthropic lấy từ Anthropic Console và đặt vào `ANTHROPIC_API_KEY` trong
file `.env`; không commit file này.

LLM mặc định dùng Anthropic trực tiếp qua `LLM_PROVIDER=anthropic`. Embedding
mặc định dùng BGE-M3 local qua `EMBEDDING_PROVIDER=local`, sinh vector 1024
chiều bằng model ONNX q8. Lần chạy embedding đầu tiên tải khoảng 570 MB; Compose
lưu cache model trong volume `embedding-model-cache` để các lần sau không phải
tải lại.
