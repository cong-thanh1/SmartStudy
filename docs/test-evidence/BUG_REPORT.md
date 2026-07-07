# BUG_REPORT.md — Danh sách Bug phát hiện và sửa (Code Review Static Analysis)

> **Ngày:** 2026-07-07  
> **Branch:** bugfix/frontend-api-contract-mismatch  
> **Người review:** AI Agent (Code-Review Static Analysis)  
> **Phương pháp:** Static analysis + đọc backend routes/schemas + cross-check với frontend services

---

## Tóm tắt

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 8 |
| 🟡 MEDIUM | 3 |
| 🟢 LOW | 1 |

---

## BUG #1 — CRITICAL: Password mặc định < 12 ký tự (Auth Register FAIL)

**File:** `frontend/src/pages/WelcomePage.tsx`  
**Triệu chứng:** Mọi attempt đăng ký đều fail với 400 VALIDATION_ERROR vì password `'12345678'` (8 chars) nhưng backend `auth-schemas.ts` bắt buộc `min(12)`.  
**Fix:** Xóa default password → user phải nhập. Thêm `minLength={12}` vào input. Hiển thị error message cụ thể từ server.  
**Status:** ✅ FIXED

---

## BUG #2 — CRITICAL: auth register gửi field `name` nhưng backend expect `fullName`

**File:** `frontend/src/services/index.ts`  
**Triệu chứng:** Backend `registerSchema` dùng `fullName` (strict schema). Frontend gửi `name` → bị reject hoặc ignore.  
**Fix:** `{ email, password, ...(name ? { fullName: name } : {}) }`  
**Status:** ✅ FIXED

---

## BUG #3 — CRITICAL: examService gọi sai endpoint

**File:** `frontend/src/services/index.ts`  
**Lỗi cũ:**
```
generateExam: POST /exams/generate            ← không tồn tại
submitAttempt: POST /grading/exams/:id/submit ← không tồn tại
```
**Backend thực tế:**
```
generateExam: POST /documents/:documentId/exams
submitAttempt: POST /exams/:examId/submit
```
**Fix:** Viết lại toàn bộ examService với đúng endpoints + thêm listExams, getExam, submitQuizAttempt, getAttempt, listAttempts.  
**Status:** ✅ FIXED

---

## BUG #4 — CRITICAL: quizService gọi sai endpoint

**File:** `frontend/src/services/index.ts`  
**Lỗi cũ:** `POST /quizzes/generate` — không tồn tại  
**Backend thực tế:** `POST /documents/:documentId/quizzes`  
**Fix:** Sửa endpoint + thêm listQuizzes, getQuiz.  
**Status:** ✅ FIXED

---

## BUG #5 — CRITICAL: Document upload service gửi sai fields + sai URL

**File:** `frontend/src/services/index.ts`  
**Vấn đề:**
1. Gửi `mimeType` thay vì `contentType` (backend schema strict)
2. Gửi `originalName` (không có trong schema strict → 400)
3. Backend upload response `{ document: {...}, upload: { url, headers } }` nhưng frontend dùng `data.uploadUrl` và `data.documentId`
4. Complete response wrapper `{ document: ... }` bị bỏ qua
5. Không truyền presigned headers vào PUT request (MinIO yêu cầu)
6. Không validate file size/type phía client

**Fix:** Sửa toàn bộ upload flow.  
**Status:** ✅ FIXED

---

## BUG #6 — CRITICAL: summaryService gọi sai endpoint và sai params

**File:** `frontend/src/services/index.ts`  
**Lỗi cũ:** `GET /summaries?documentId=...&type=FULL`  
**Backend thực tế:** `GET /documents/:id/summary?scope=full|chapter&chapterRef=...`  
**Fix:** Sửa endpoint + đổi `type` → `scope`, `chapterIndex` → `chapterRef`. Thêm `generateSummary` (POST).  
**Status:** ✅ FIXED

---

## BUG #7 — CRITICAL: tutorService gửi extra fields vi phạm strict schema

**File:** `frontend/src/services/index.ts`  
**Vấn đề:** Frontend gửi `chapterIndex`, `contextSnippet` nhưng backend `tutorAskRequestSchema` là `.strict()` → 400 VALIDATION_ERROR  
**Fix:** Chỉ gửi `question`, `documentId`.  
**Status:** ✅ FIXED

---

## BUG #8 — CRITICAL: Document status badge so sánh sai case

**File:** `frontend/src/pages/DashboardPage.tsx`  
**Vấn đề:** `doc.status === 'READY'` nhưng backend trả về lowercase `'ready'` → badge không bao giờ hiển thị đúng  
**Fix:** Đổi sang lowercase: `'ready'`, `'processing'`, `'uploading'`  
**Status:** ✅ FIXED

---

## BUG #9 — MEDIUM: ExamCenterPage submit format sai

**File:** `frontend/src/pages/ExamCenterPage.tsx`  
**Vấn đề:** `userAnswers` là `Record<string, number>` (index) nhưng backend `submitAttemptRequestSchema` yêu cầu `{ question_id, selected_answer }[]` với `selected_answer` là text string  
**Fix:** Đổi sang `Record<string, string>` + chuyển đổi đúng format khi submit  
**Status:** ✅ FIXED

---

## BUG #10 — MEDIUM: Quiz submit không gọi API

**File:** `frontend/src/pages/ExamCenterPage.tsx`  
**Vấn đề:** Quiz submit tự tính điểm client-side (hardcoded logic, dùng `correctOptionIndex` không tồn tại trên QuizQuestion từ backend). Backend có route `POST /quizzes/:quizId/submit` nhưng không được dùng.  
**Fix:** Gọi `examService.submitQuizAttempt()` → dùng AI grading từ backend  
**Status:** ✅ FIXED

---

## BUG #11 — MEDIUM: ResultsPage không xử lý được format ExamAttempt mới

**File:** `frontend/src/pages/ResultsPage.tsx`  
**Vấn đề:** ResultsPage đọc `parsed.result` nhưng ExamCenterPage lưu `parsed.attempt` (format mới). Data không được hiển thị.  
**Fix:** Thêm adapter chuyển ExamAttempt → GradingResult cho AiFeedbackCard  
**Status:** ✅ FIXED

---

## BUG #12 — LOW: 401 interceptor không thử refresh token

**File:** `frontend/src/services/api.ts`  
**Vấn đề:** Khi access token hết hạn, frontend clear auth và redirect ngay thay vì thử `/auth/refresh`  
**Fix:** Thêm proper refresh token logic với retry  
**Status:** ✅ FIXED

---

## Không có bug nào trong:
- Backend auth logic (bcrypt, JWT signing, token revocation)
- Backend exam answer key security (answerKey: undefined khi mode='take')
- Backend rate limiting (200 req/min)
- Docker Compose services
- Vite proxy config (đã fix session trước)
