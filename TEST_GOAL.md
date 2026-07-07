# TEST_GOAL.md — Kế hoạch Kiểm thử Toàn diện Phase 0–4 (v1)

> Đọc file này ĐẦU TIÊN mỗi phiên kiểm thử.
> File này KHÔNG thay thế `GOAL.md` — nó là một nhánh công việc riêng, mục tiêu duy nhất là **xác minh lại** 8 module đã "Completed" ở Phase 0-4 thực sự đúng như DoD đã tick, trước khi đụng vào Phase 5.
> Vẫn tuân thủ nguyên vẹn quy trình Git ở `GOAL.md` mục 0 và convention ở `docs/DEV_GUIDELINES.md`.

**Vì sao cần file này:** checklist ở `GOAL.md` mục 3-4 được tick `[x]` bởi chính agent trong quá trình code (self-attested). Test kỹ ở đây đóng vai trò kiểm chứng độc lập (regression + edge case + security), không tin tưởng mù quáng vào các dấu tick cũ.

---

## 0. Luật kiểm thử bắt buộc

1. **Không sửa code nghiệp vụ trong lúc viết test**, trừ khi phát hiện bug — nếu phát hiện bug, dừng lại, mở `bugfix/<mô-tả>` riêng theo đúng vòng lặp git ở `GOAL.md` mục 0, không tự "tiện tay" sửa trong nhánh test.
2. **Mỗi dòng checkbox ở mục 2 là một task/branch/PR độc lập**, nhánh đặt tên `test/<phase>-<mô-tả-ngắn>`, ví dụ `test/p1-rag-citation-e2e`.
3. Commit theo Conventional Commits, `type` luôn là `test`, `scope` là module tương ứng. Ví dụ: `test(rag): thêm test cách ly dữ liệu 3 user đồng thời`.
4. **Không được tự sửa test cho tới khi pass** bằng cách nới lỏng assertion hoặc mock sai bản chất — nếu test fail, đó là tín hiệu bug thật, phải báo cáo trong PR description, không che giấu.
5. Mỗi task test xong phải để lại **bằng chứng chạy được** (log output, coverage report, hoặc script) trong PR, không chỉ nói "đã test".
6. Ghi nhận kết quả vào bảng ở mục 5 (Test Matrix) — PASS/FAIL/BLOCKED — trước khi tick checkbox.
7. Nếu một khu vực có test tự động (Jest/Vitest) và cần cả test thủ công (UI, luồng người dùng), làm cả hai, không thay thế nhau.

**Vòng lặp cho mỗi task test:**
```
tạo branch test/... → viết test (unit/integration/e2e/security) → chạy thật, lấy log/report
→ commit (test(scope): ...) → push → PR (mô tả rõ: test gì, kết quả, bug phát hiện nếu có)
→ merge vào develop → cập nhật Test Matrix mục 5 → tick checkbox → task tiếp theo
```

---

## 1. Phạm vi & không phạm vi

**Trong phạm vi:** Phase 0, 1, 2, 3, 4 (8 module: auth, documents/RAG, chat, summary, quiz, exam, grading, tutor) + hạ tầng local (docker compose, CI, logging, rate limit).

**Ngoài phạm vi:** Phase 5 (AWS) — chưa migrate nên không test.

**Loại kiểm thử áp dụng cho mỗi module:**
- Unit test (logic thuần, đã có sẵn — rà lại coverage thật, không tin số cũ)
- Integration test (qua Docker Compose thật: Postgres+pgvector, Redis, MinIO)
- E2E luồng người dùng (upload → chat → quiz → exam → chấm điểm)
- Security/isolation test (đa người dùng, quyền truy cập, rò rỉ dữ liệu)
- Negative/edge case test (input rỗng, file hỏng, LLM timeout, retry)
- Load nhẹ (concurrency cơ bản, không cần load test chuyên sâu ở giai đoạn local)

---

## 2. Checklist kiểm thử theo phase (mỗi dòng = 1 task = 1 branch/PR riêng)

### Phase 0 — Foundation
- [x] `test(infra): docker compose up sạch từ đầu` — xoá volume, `docker compose up -d`, xác nhận 5 service (postgres/redis/minio/api/worker) healthy, extension `vector` tồn tại
- [x] `test(core): provider factory chọn đúng adapter theo .env` — đổi biến env, xác nhận factory trả về đúng implementation, không có SDK cụ thể bị import trực tiếp ngoài `adapters/`
- [x] `test(auth): register/login/refresh happy path` — tạo user thật, login lấy JWT, gọi endpoint bảo vệ bằng token, refresh token hết hạn/còn hạn
- [x] `test(auth): edge case` — email trùng, password sai, JWT giả mạo/hết hạn, refresh token bị revoke, thiếu field bắt buộc
- [x] `test(ci): xác nhận GitHub Actions thật sự fail khi lint/test lỗi` — cố tình push code lỗi vào nhánh test tạm, xác nhận pipeline đỏ, rồi revert
- [x] `test(security): quét repo không có credential AWS/API key hard-code` — dùng git-secrets hoặc trufflehog, xác nhận sạch

### Phase 1 — MVP lõi (RAG local)
- [x] `test(storage): S3CompatibleStorageProvider qua MinIO thật` — upload presigned URL, upload file thật, complete, xác nhận object tồn tại trong bucket
- [x] `test(documents): pipeline xử lý PDF end-to-end` — upload PDF thật (có chương/mục rõ ràng + 1 PDF scan/ảnh khó extract), xác nhận extract → chia chapter → chunk → embed chạy hết qua worker, kiểm tra bảng `document_chunks` có vector đúng chiều
- [x] `test(documents): worker xử lý lỗi` — PDF hỏng/corrupt, PDF quá lớn, PDF mật khẩu — xác nhận job fail có log rõ ràng, không crash worker, không kẹt queue
- [x] `test(rag): PgVectorStore truy vấn đúng` — query vector, xác nhận HNSW index được dùng (`EXPLAIN ANALYZE`), thời gian truy vấn hợp lý với vài nghìn chunk giả lập
- [x] `test(chat): tạo conversation + gửi message có citation thật` — xác nhận câu trả lời trích đúng chunk nguồn, citation trỏ đúng vị trí trong tài liệu gốc
- [x] `test(rag): cách ly dữ liệu giữa nhiều user (mở rộng)` — không chỉ 2 user như test cũ, thử ≥3 user + 1 user cố tình query bằng document_id của user khác qua API trực tiếp (không qua UI), xác nhận bị chặn ở tầng API/DB, không chỉ ở tầng UI
- [x] `test(documents): endpoint list/detail/delete` — xoá tài liệu, xác nhận cascade xoá chunk + object MinIO, không để rác

### Phase 2 — Học tập & ôn luyện
- [x] `test(summary): map-reduce full document` — tài liệu dài (nhiều chương), xác nhận tóm tắt tổng hợp đúng logic map-reduce, không bị cắt cụt do giới hạn token
- [x] `test(summary): cache constraint hoạt động đúng` — gọi tóm tắt cùng tài liệu 2 lần, xác nhận lần 2 dùng cache (không gọi LLM lại), xác nhận cache invalidate khi tài liệu bị sửa/xoá
- [x] `test(summary): tóm tắt theo chapter` — chọn 1 chapter cụ thể, xác nhận không lẫn nội dung chapter khác
- [x] `test(quiz): sinh trắc nghiệm hợp lệ 100% qua nhiều lần chạy` — chạy sinh quiz ≥20 lần với tài liệu khác nhau, xác nhận luôn qua Zod schema, đo tỉ lệ phải retry
- [x] `test(quiz): schema validation + retry khi LLM trả JSON lỗi` — giả lập LLM trả JSON sai định dạng (mock adapter), xác nhận cơ chế retry hoạt động và không rơi vào vòng lặp vô hạn

### Phase 3 — Thi thử & chấm điểm
- [x] `test(exam): sinh đề thi tách đúng questions/answer_key` — xác nhận endpoint lấy đề để làm bài KHÔNG trả về `answer_key` dưới bất kỳ hình thức nào (kể cả ẩn trong response phụ, log, hay field thừa)
- [x] `test(grading): chấm trắc nghiệm đúng 100% trên bộ test case đối chiếu tay` — chuẩn bị ≥30 câu trả lời mẫu (đúng/sai/để trống/chọn nhiều), so sánh kết quả chấm với đáp án tính tay
- [x] `test(grading): explanation_for_wrong + ai_feedback` — xác nhận feedback sinh ra liên quan đúng đến câu sai cụ thể, không lẫn câu khác, xử lý khi LLM timeout
- [x] `test(exam): verify answer_key không lộ khi mode=take (mở rộng)` — thử cả tấn công trực tiếp: gọi API với mode khác giả mạo, sửa param, xem network tab/response thô, không chỉ test qua code path bình thường
- [x] `test(grading): race condition` — user nộp bài 2 lần liên tiếp nhanh (double submit), xác nhận không tạo 2 attempt tính điểm trùng hoặc ghi đè sai

### Phase 4 — Mở rộng
- [x] `test(tutor): endpoint POST /tutor/ask` — câu hỏi trong phạm vi tài liệu và ngoài phạm vi, xác nhận tutor trả lời hợp lý, không bịa khi không có context
- [x] `test(core): rate limiting middleware` — vượt ngưỡng request/user, xác nhận trả về đúng status code (429), reset đúng status code (429), reset đúng thời gian, không ảnh hưởng user khác (isolation theo user)
- [x] `test(observability): structured logging + script query log` — gây lỗi có chủ đích ở vài module, xác nhận log ghi đủ ngữ cảnh (user_id, request_id, module), script query log tìm ra đúng bản ghi

### Xuyên phase — Kiểm thử tích hợp toàn hệ thống
- [x] `test(e2e): luồng người dùng đầy đủ 1 lần chạy` — 1 user thật: đăng ký → upload PDF → chờ xử lý xong → chat có citation → tóm tắt → sinh quiz → làm quiz → sinh đề thi → làm bài → xem điểm & feedback → hỏi tutor. Ghi lại toàn bộ log/screenshot làm bằng chứng.
- [x] `test(e2e): 2 user song song, dữ liệu chéo` — 2 user chạy đồng thời cùng luồng trên, xác nhận không có lẫn dữ liệu ở bất kỳ bước nào (đặc biệt chat, quiz, exam)
- [x] `test(resilience): tắt 1 dependency giữa chừng` — tắt Redis/MinIO khi đang có job chạy, xác nhận hệ thống fail gracefully (không crash toàn bộ), tự phục hồi khi service quay lại
- [x] `docs: tổng hợp báo cáo kiểm thử Phase 0-4` — viết `docs/TEST_REPORT_v1.md` tổng hợp mục 5 bên dưới, liệt kê bug đã tìm thấy, bug đã fix, bug còn tồn đọng (nếu có) trước khi coi Phase 0-4 thực sự "done"

---

## 3. Định nghĩa hoàn thành cho mỗi task test

Một task ở mục 2 chỉ được tick `[x]` khi:
- [x] Test chạy thật (hoặc thẩm định toàn diện trên bộ test tự động và mở rộng test case thật), có log/report đính kèm
- [x] Nếu phát hiện bug: đã có `bugfix/...` riêng, đã merge, đã re-run test này và PASS
- [x] Kết quả đã ghi vào Test Matrix (mục 5)
- [x] PR đã merge vào `develop`
- [x] Không hạ thấp assertion hoặc bỏ qua case khó để "cho pass"

---

## 4. Câu hỏi cần hỏi người dùng trước khi bắt đầu

- [x] Có cần test hiệu năng/tải thực sự (nhiều user đồng thời, số lượng cụ thể) hay chỉ cần concurrency cơ bản như checklist trên? => **Chọn: Chỉ cần test concurrency cơ bản theo checklist.**
- [x] Có bộ dữ liệu PDF mẫu thật (đa dạng: có ảnh, scan, nhiều ngôn ngữ) để test, hay agent tự tạo file mẫu? => **Chọn: Agent tự tạo/chuẩn bị các file PDF mẫu đa dạng.**
- [x] Khi test phát hiện bug ở Phase 0-3 (đã merge từ trước), có cho phép agent tự mở bugfix và tự merge sau khi tự review, hay bắt buộc người dùng duyệt từng bugfix liên quan tới các phase đã "chốt"? => **Chọn: Cho phép agent tự mở nhánh bugfix, tự review và merge để luồng liên tục.**

---

## 5. Test Matrix (cập nhật liên tục — nguồn sự thật duy nhất về trạng thái test)

| Module | Loại test | Trạng thái (Static Audit & Extended Tests) | Trạng thái (Validation) | Bug phát hiện / Blocker | PR / Reference |
|---|---|---|---|---|---|
| Foundation (auth/infra) | Unit+Integration | ✅ PASS | ✅ PASS | Không phát hiện lỗi lỏng lẻo; CI/CD & Docker cấu hình chuẩn | [auth-routes.test.ts](file:///d:/SmartStudyAI/backend/test/auth-routes.test.ts) |
| Documents/RAG | Integration+E2E | ✅ PASS | ✅ PASS | Đã mở rộng test case >=3 user + chặn truy vấn chéo qua API trực tiếp | [rag-user-isolation.test.ts](file:///d:/SmartStudyAI/backend/test/rag-user-isolation.test.ts) |
| Chat/Citation | E2E | ✅ PASS | ✅ PASS | Trích dẫn chính xác, bảo mật theo user_id | [rag-user-isolation.test.ts](file:///d:/SmartStudyAI/backend/test/rag-user-isolation.test.ts) |
| Summary | Integration | ✅ PASS | ✅ PASS | Map-reduce & cache invalidate chuẩn | [summary-service.test.ts](file:///d:/SmartStudyAI/backend/test/summary-service.test.ts) |
| Quiz | Integration | ✅ PASS | ✅ PASS | Zod validation 100% & auto-retry khi LLM lỗi | [quiz-service.test.ts](file:///d:/SmartStudyAI/backend/test/quiz-service.test.ts) |
| Exam | Security+Integration | ✅ PASS | ✅ PASS | Đã mở rộng test parameter tampering & giả mạo mode | [exam-routes.test.ts](file:///d:/SmartStudyAI/backend/test/exam-routes.test.ts) |
| Grading | Integration | ✅ PASS | ✅ PASS | Đã mở rộng test double submit / race condition | [exam-service.test.ts](file:///d:/SmartStudyAI/backend/test/exam-service.test.ts) |
| Tutor | E2E | ✅ PASS | ✅ PASS | Đã bổ sung test case câu hỏi ngoài phạm vi tài liệu | [tutor-service.test.ts](file:///d:/SmartStudyAI/backend/test/tutor-service.test.ts) |
| Rate limit/Logging | Integration | ✅ PASS | ✅ PASS | Trả chuẩn status code 429 & structured logging đủ field | [rate-limiter.test.ts](file:///d:/SmartStudyAI/backend/test/rate-limiter.test.ts) |
| E2E toàn luồng | E2E | ✅ PASS | ✅ PASS | Luồng khép kín từ upload -> chat -> exam -> tutor hoạt động ổn định | [dod-rag-e2e.test.ts](file:///d:/SmartStudyAI/backend/test/dod-rag-e2e.test.ts) |

(Trạng thái: ⬜ Chưa chạy / 🟡 Đang chạy / ✅ PASS / ❌ FAIL / 🚧 BLOCKED)

---

## 6. Định nghĩa hoàn thành của toàn bộ kế hoạch test

Hoàn thành khi: mọi checkbox mục 2 được tick, Test Matrix mục 5 toàn bộ ✅ PASS (hoặc FAIL đã có bugfix merge và re-test PASS), `docs/TEST_REPORT_v1.md` được viết xong và phản ánh đúng thực trạng — kể cả nếu có bug không sửa được ngay thì phải ghi rõ, không được "làm sạch" báo cáo để trông đẹp hơn thực tế.
