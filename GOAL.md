# GOAL.md — Mục tiêu, Kế hoạch & Quy trình Git (v3)

> Đọc file này ĐẦU TIÊN mỗi phiên làm việc.
> Đặc tả kỹ thuật đầy đủ: `docs/SmartStudy_AI_Requirements_v2.md`.
> Quy định git/code convention đầy đủ: `docs/DEV_GUIDELINES.md` (tài liệu team đã có — file này chỉ trích các phần bắt buộc áp dụng trực tiếp lên kế hoạch).

**Thay đổi so với v2:** thêm quy trình Git bắt buộc — **mỗi module/task nhỏ xong PHẢI commit + push + mở PR ngay**, không được gom nhiều module rồi push một lần. Agent coi mỗi checkbox cấp task (không phải cấp phase) là một đơn vị commit/PR độc lập.

---

## 0. Luật Git bắt buộc — áp dụng cho MỌI task trong checklist

**Đây là quy tắc quan trọng nhất của file này. Vi phạm = phải sửa lại trước khi tiếp tục.**

1. **Không làm việc rồi gom code lại push 1 lần cuối phase.** Mỗi task (mỗi dòng checkbox ở mục 2) là 1 đơn vị làm việc độc lập: code → test → commit → push → PR → merge → **rồi mới bắt đầu task tiếp theo**.
2. **Branch:** tạo nhánh mới từ `develop` cho mỗi task, đặt tên theo `feature/<phase>-<mô-tả-ngắn>` (bugfix thì `bugfix/...`). Ví dụ: `feature/p1-document-upload`, `feature/p1-rag-chat-endpoint`.
3. **Commit message theo Conventional Commits** (xem `docs/DEV_GUIDELINES.md` mục 1.2):
   ```
   <type>(<scope>): <subject>
   ```
   - `type`: feat / fix / docs / refactor / test / chore
   - `scope`: tên module (`auth`, `documents`, `chat`, `summary`, `quiz`, `exam`, `grading`, `tutor`, `infra`)
   - Ví dụ: `feat(documents): thêm endpoint upload presigned URL qua MinIO adapter`
4. **Trước khi commit** task nào, phải đạt tối thiểu:
   - Code chạy được, không lỗi lint
   - Có unit test cho logic mới (mock qua interface, theo nguyên tắc Ports & Adapters ở `docs/SmartStudy_AI_Requirements_v2.md` mục 1)
   - Không có secret/credential hard-code
5. **Push ngay sau commit** — không giữ code local nhiều task liên tiếp rồi push 1 lượt.
6. **Mở PR ngay sau khi push**, dùng template PR chuẩn (mô tả, checklist, cách test) theo `docs/DEV_GUIDELINES.md` mục 1.3. Nếu agent tự chạy một mình không có reviewer con người ngay lúc đó, vẫn phải mở PR đúng chuẩn — merge sau khi tự rà lại checklist review (mục 3.1 của DEV_GUIDELINES) hoặc chờ người dùng approve nếu được yêu cầu.
7. **Một PR = một task/module**, không gộp 2-3 task vào 1 PR để "tiết kiệm thời gian". PR nhỏ dễ review, dễ revert nếu sai.
8. Sau khi PR được merge vào `develop`, agent tick `[x]` task đó trong file GOAL.md này **và commit luôn thay đổi này** (`docs: update GOAL.md checklist`) trước khi bắt đầu task kế tiếp.
9. Nếu 1 task bị lỗi/phải sửa sau khi đã merge → tạo `bugfix/...` riêng, không sửa trực tiếp trên `develop`.

**Tóm tắt vòng lặp cho mỗi task:**
```
tạo branch → code + test → commit (Conventional Commits) → push
→ mở PR (dùng template) → tự review theo checklist mục 3.1 DEV_GUIDELINES
→ merge vào develop → tick checkbox trong GOAL.md + commit → task tiếp theo
```

---

## 1. Ràng buộc kỹ thuật xuyên suốt (không đổi từ v2)

- Không gọi trực tiếp SDK cụ thể (AWS SDK, Anthropic SDK...) trong code nghiệp vụ — mọi thứ qua interface trong `backend/src/ports/`, chọn adapter qua `provider-factory.ts`.
- Storage dùng MinIO (S3-compatible), vector search dùng pgvector trên Postgres — không thêm hạ tầng ngoài Docker Compose ở giai đoạn local.
- Không code phase sau khi phase hiện tại chưa đạt Definition of Done.
- Coverage tối thiểu 80% cho logic nghiệp vụ (theo `docs/DEV_GUIDELINES.md` mục 4.1), 100% cho các hàm chấm điểm/so sánh đáp án (critical path).

---

## 2. Trạng thái hiện tại

**Phase đang làm:** `Phase 0 — Foundation (local)`
**Task/branch đang mở (nếu có):** `feature/p0-prisma-users`
**Cập nhật lần cuối:** `2026-07-04`

---

## 3. Checklist theo phase (mỗi dòng = 1 task = 1 branch/commit/PR riêng)

### Phase 0 — Foundation (local)
- [x] `chore(infra): khởi tạo repo structure` — tạo `frontend/`, `backend/`, `docs/`, `docker-compose.yml`
- [x] `chore(infra): setup docker compose` — postgres(pgvector), redis, minio, api, worker chạy được `docker compose up -d`
- [x] `feat(core): định nghĩa 7 port interface` — Storage, VectorStore, LLM, Embedding, Auth, Queue, Email trong `backend/src/ports/`
- [x] `feat(core): provider factory đọc .env` — chọn adapter theo config
- [ ] `feat(db): prisma schema + migration đầu tiên` — bảng `users`, extension `vector`
- [ ] `feat(auth): JwtAuthProvider + endpoint register/login/refresh`
- [ ] `chore(ci): setup GitHub Actions lint + test`
- [ ] **DoD Phase 0:** đăng ký/đăng nhập thật, JWT hợp lệ, chạy qua `docker compose up`, mỗi task trên đã có PR riêng đã merge vào `develop`, không có credential AWS trong repo

### Phase 1 — MVP lõi (RAG local)
- [ ] `feat(storage): S3CompatibleStorageProvider (MinIO)` implement `IStorageProvider`
- [ ] `feat(db): migration bảng documents + document_chunks`
- [ ] `feat(documents): endpoint upload presigned URL + complete`
- [ ] `feat(queue): RedisQueueProvider (BullMQ) + worker process riêng`
- [ ] `feat(documents): pipeline xử lý PDF trong worker` (extract → chapters → chunk → embed)
- [ ] `feat(llm): AnthropicLLMProvider + embedding provider`
- [ ] `feat(rag): PgVectorStore implement IVectorStore (HNSW index)`
- [ ] `feat(documents): endpoint list/detail/delete`
- [ ] `feat(chat): endpoint tạo conversation + gửi message có citation`
- [ ] `test(rag): test cách ly dữ liệu giữa 2 user` — bắt buộc, PR riêng, không gộp vào task tính năng
- [ ] **DoD Phase 1:** upload PDF thật → chat nhận câu trả lời kèm citation, mỗi task đã merge riêng lẻ vào `develop` theo đúng vòng lặp git ở mục 0

### Phase 2 — Học tập & ôn luyện
- [ ] `feat(db): migration bảng summaries (unique cache constraint)`
- [ ] `feat(summary): map-reduce summarization full document`
- [ ] `feat(summary): tóm tắt theo chapter`
- [ ] `feat(db): migration bảng quizzes`
- [ ] `feat(quiz): endpoint sinh trắc nghiệm + validate Zod schema + retry`
- [ ] **DoD Phase 2:** quiz sinh hợp lệ 100%, cache summary hoạt động, mỗi task có PR riêng đã merge

### Phase 3 — Thi thử & chấm điểm
- [ ] `feat(db): migration bảng exams + exam_attempts`
- [ ] `feat(exam): endpoint sinh đề thi (tách questions/answer_key)`
- [ ] `feat(grading): endpoint nộp bài + chấm trắc nghiệm (so sánh JS thuần)`
- [ ] `feat(grading): sinh explanation_for_wrong + ai_feedback qua LLM`
- [ ] `test(exam): verify answer_key không lộ khi mode=take` — PR riêng
- [ ] **DoD Phase 3:** làm đề thi thật, điểm đúng 100%, feedback hợp lý, từng task đã merge riêng

### Phase 4 — Mở rộng (vẫn local)
- [ ] `feat(tutor): endpoint POST /tutor/ask`
- [ ] `feat(core): rate limiting middleware theo user`
- [ ] `chore(observability): structured logging + script query log cơ bản`
- [ ] **DoD Phase 4:** demo end-to-end 8 module, mỗi task có lịch sử PR riêng biệt trên `develop`

### Phase 5 — Migrate AWS (chỉ làm khi được yêu cầu rõ ràng)
- [ ] `feat(llm): BedrockLLMProvider + BedrockEmbeddingProvider`
- [ ] `chore(infra): migrate Postgres sang RDS/Aurora (pgvector)`
- [ ] `chore(infra): đổi STORAGE_ENDPOINT sang S3 thật`
- [ ] `chore(infra): containerize + deploy ECS Fargate/App Runner`
- [ ] (tuỳ chọn) `feat(queue): SqsQueueProvider`
- [ ] (tuỳ chọn) `feat(auth): CognitoAuthProvider`
- [ ] `chore(observability): CloudWatch logs/alarms`
- [ ] **DoD Phase 5:** hệ thống chạy trên AWS, chạy lại toàn bộ test tích hợp Phase 0-4 và pass 100%, mỗi thay đổi migrate có PR riêng, không merge thẳng lên `main` mà không qua `develop`/review

---

## 4. Áp dụng Definition of Done cấp task (theo `docs/DEV_GUIDELINES.md` mục 10.1)

Một task trong checklist mục 3 chỉ được tick `[x]` khi:
- [ ] Code tuân thủ convention (naming, structure, import order — mục 2 DEV_GUIDELINES)
- [ ] Unit test viết và pass, coverage ≥ 80% (100% cho path chấm điểm)
- [ ] Không có warning/error khi lint
- [ ] PR đã được tạo đúng template, đã tự/được review theo checklist mục 3.1 DEV_GUIDELINES
- [ ] Đã merge vào `develop` (không còn nằm ở feature branch)
- [ ] Không có secret hard-code, đã qua Security Checklist mục 6.4 nếu task liên quan auth/dữ liệu nhạy cảm

---

## 5. Câu hỏi cần hỏi người dùng trước khi bắt đầu Phase 1

- [ ] LLM provider local dev: Anthropic API trực tiếp (giả định) hay khác?
- [ ] Model embedding cụ thể (chốt số chiều `VECTOR(n)` trước migration đầu tiên)
- [ ] Có cần câu hỏi tự luận ở Phase 3?
- [ ] Ngôn ngữ tài liệu đầu vào: chỉ tiếng Việt hay đa ngôn ngữ?
- [ ] Ai là reviewer PR trong giai đoạn agent tự làm — người dùng có muốn review từng PR trước khi merge, hay để agent tự merge sau khi tự kiểm tra checklist?

---

## 6. Định nghĩa hoàn thành

Hoàn thành giai đoạn local = đạt DoD Phase 0-4, **và** lịch sử Git thể hiện đúng quy trình: nhiều commit/PR nhỏ theo từng module, không có commit khổng lồ gộp nhiều tính năng, `develop` luôn ở trạng thái chạy được sau mỗi lần merge. Phase 5 (AWS) chỉ bắt đầu khi được yêu cầu rõ ràng, và cũng tuân theo đúng vòng lặp git ở mục 0.
