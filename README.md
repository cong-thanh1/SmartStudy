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

Các endpoint local:

- API health: <http://localhost:3000/health>
- MinIO API: <http://localhost:9000>
- MinIO Console: <http://localhost:9001>
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Kiểm tra nhanh:

```bash
curl http://localhost:3000/health
docker compose logs worker
```

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
