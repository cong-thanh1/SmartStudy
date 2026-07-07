# BROWSER_TEST_GOAL.md — Kiểm thử Browser Chi tiết trước Bàn giao Khách hàng (v2)

> Đọc file này ĐẦU TIÊN. File này thay thế bản v1, viết chi tiết tới mức từng bước thao tác cụ thể + kết quả mong đợi cụ thể, vì mục tiêu là **bàn giao cho khách hàng**, không phải kiểm thử nội bộ thông thường.
> Vẫn tuân thủ nguyên vẹn quy trình Git ở `GOAL.md` mục 0. Mọi bug tìm thấy đều phải fix xong và re-test PASS trước khi coi là sẵn sàng bàn giao — **không bàn giao kèm bug đã biết mà chưa báo cáo rõ ràng cho khách hàng**.

**Bối cảnh:** đây là lần kiểm thử cuối cùng trước khi khách hàng nhận sản phẩm. Mọi lỗi phát hiện sau bàn giao sẽ ảnh hưởng trực tiếp đến uy tín. Vì vậy mức độ chi tiết ở đây cao hơn hẳn `TEST_GOAL.md` thông thường — không được bỏ qua bước nào, không được "chạy nhanh cho xong".

---

## 0. Luật kiểm thử bắt buộc (chi tiết hơn v1)

1. **Mở DevTools (F12) → tab Network với "Preserve log" bật, tab Console mở song song** trước MỌI thao tác. Không tắt DevTools giữa chừng vì sẽ mất request đã log.
2. **Mỗi module ở mục 2 = 1 branch/PR riêng**: `test/browser-<module>`.
3. **Ghi log theo đúng định dạng bảng ở mục 6 (Biên bản kiểm thử)** cho từng bước, không chỉ ghi tổng kết cuối cùng — khách hàng có thể yêu cầu xem chi tiết từng bước.
4. **Chụp màn hình bắt buộc** ở các mốc: trước thao tác, ngay sau khi có kết quả, và Network tab tương ứng — lưu vào `docs/test-evidence/<module>/`.
5. **Test trên tối thiểu 2 trình duyệt khác nhau** (Chrome + 1 trình duyệt khác nếu có sẵn) cho các luồng chính (auth, upload, chat, exam) vì khách hàng có thể dùng browser bất kỳ.
6. **Mọi số liệu cụ thể (thời gian phản hồi, dung lượng, số lượng) phải đo thật**, không ước lượng — dùng số liệu trong tab Network (cột Time, Size).
7. **Test cả trên dữ liệu "bẩn"**: tên file có ký tự đặc biệt/tiếng Việt có dấu, câu hỏi chat bằng cả tiếng Việt và tiếng Anh, câu hỏi rất dài, câu hỏi rỗng.
8. **Nếu tìm thấy bug**: mở `bugfix/...`, fix, merge, quay lại chạy LẠI TOÀN BỘ bước của module đó từ đầu (không chỉ chạy lại bước lỗi) — vì fix có thể ảnh hưởng bước khác.
9. **Không tick `[x]` nếu chưa có đủ 3 thứ**: log chi tiết + ảnh chụp + kết quả PASS thật (không phải "gần đúng" hay "chấp nhận được").
10. Cuối cùng, mọi kết quả tổng hợp vào `docs/HANDOFF_TEST_REPORT.md` (mục 7) — đây là tài liệu sẽ đưa cho khách hàng, nên viết bằng ngôn ngữ khách hàng hiểu được (hạn chế thuật ngữ kỹ thuật quá sâu), có phần tóm tắt điều hành (executive summary) ở đầu.

**Vòng lặp cho mỗi module:**
```
mở DevTools + chuẩn bị dữ liệu test → chạy từng bước trong mục 2 theo đúng thứ tự
→ ghi log chi tiết (mục 6) + chụp ảnh + lưu HAR nếu cần
→ nếu PASS hết: commit + push + PR (đính kèm toàn bộ bằng chứng) → merge
→ nếu có bug: dừng, mở bugfix riêng, fix, merge, CHẠY LẠI TOÀN BỘ module từ bước 1
→ cập nhật Test Matrix (mục 8) → tick checkbox → module tiếp theo
```

---

## 1. Chuẩn bị môi trường (bắt buộc trước khi bắt đầu bất kỳ module nào)

- [ ] Xác nhận URL frontend chính xác (hỏi lại người dùng nếu chưa biết cổng)
- [ ] `docker compose down -v && docker compose up -d` — môi trường sạch hoàn toàn, không còn dữ liệu test cũ lẫn vào
- [ ] Chờ tất cả service healthy (`docker compose ps`), ghi lại thời gian khởi động
- [ ] Tạo 3 tài khoản test: `qa_user_a@test.com`, `qa_user_b@test.com`, và 1 tài khoản đặt tên/mật khẩu giống hệt định dạng khách hàng sẽ dùng thật (để demo)
- [ ] Chuẩn bị bộ file test:
  - `sample_clean.pdf` — PDF text thuần, có mục lục rõ, ~10-20 trang
  - `sample_scan.pdf` — PDF dạng ảnh scan (khó extract text)
  - `sample_vietnamese_ký_tự_đặc_biệt (1).pdf` — tên file có dấu, khoảng trắng, ngoặc
  - `sample_corrupt.pdf` — file PDF bị hỏng cố ý (đổi vài byte)
  - `sample_huge.pdf` — file gần giới hạn dung lượng cho phép (nếu hệ thống có giới hạn, kiểm tra config để biết số cụ thể)
- [ ] Tạo thư mục `docs/test-evidence/` với subfolder cho từng module

---

## 2. Kịch bản kiểm thử chi tiết theo module

> Định dạng mỗi bước: **Thao tác** → **Request mong đợi** → **Kết quả mong đợi trên UI** → **Điều cần kiểm tra thêm**

### Module A — Đăng ký / Đăng nhập (`test/browser-auth`)

**A1. Đăng ký thành công**
1. Mở trang đăng ký. Điền email `qa_user_a@test.com`, mật khẩu hợp lệ theo policy (kiểm tra policy thật trong code nếu UI không ghi rõ), họ tên.
2. Bấm "Đăng ký". → Mong đợi: `POST /auth/register`, status `200`/`201`, response chứa user id (không chứa password dù đã hash).
3. UI: chuyển hướng đúng trang (login hoặc thẳng vào dashboard tuỳ thiết kế) trong ≤ 2 giây.
4. Kiểm tra thêm: mở tab Application → Cookies/LocalStorage, xác nhận token được lưu đúng chỗ thiết kế, không lưu password ở đâu cả.

**A2. Đăng ký trùng email**
1. Lặp lại bước A1 với cùng email.
2. Mong đợi: status `4xx` (409 hoặc 400), message lỗi hiển thị rõ ràng bằng tiếng Việt/Anh tuỳ ngôn ngữ UI, không phải màn hình trắng hoặc lỗi console không xử lý.

**A3. Đăng nhập đúng / sai**
1. Login đúng mật khẩu → `POST /auth/login` status 200, token nhận được, redirect vào dashboard.
2. Login sai mật khẩu 3 lần liên tiếp → xác nhận thông báo lỗi rõ, kiểm tra có cơ chế khoá tạm/captcha hay không (nếu có trong spec), nếu không có thì ghi chú vào báo cáo là điểm cần lưu ý cho khách hàng.

**A4. Refresh token / hết phiên**
1. Login xong, để trình duyệt mở, dùng DevTools sửa thời gian hệ thống hoặc đợi tới khi access token hết hạn (ghi thời gian hết hạn thật từ token decode ở jwt.io — chỉ decode, không gửi token thật lên site ngoài nếu là môi trường thật).
2. Thao tác tiếp (VD load lại danh sách tài liệu) → xác nhận UI tự gọi `POST /auth/refresh` ngầm, người dùng không bị văng ra ngoài đột ngột.
3. Xoá refresh token cố ý (qua Application tab) → thao tác tiếp → xác nhận UI redirect về login đúng cách, không lỗi vòng lặp.

**A5. Logout**
1. Bấm logout → xác nhận token bị xoá khỏi client, gọi API revoke nếu có, không thể dùng back button để quay lại trang đã đăng nhập.

---

### Module B — Upload & Xử lý Tài liệu (`test/browser-documents-upload`)

**B1. Upload PDF sạch, theo dõi toàn bộ luồng**
1. Vào trang upload, chọn `sample_clean.pdf`.
2. Mong đợi thấy tối thiểu các request theo thứ tự: lấy presigned URL (`POST/GET .../presign`) → `PUT` thẳng lên MinIO (domain MinIO, không phải backend) → gọi complete (`POST .../complete`).
3. Ghi lại thời gian từng bước (cột Time trong Network) và dung lượng file thật vs dung lượng đã upload (phải khớp).
4. UI hiển thị trạng thái "đang xử lý" → theo dõi cơ chế cập nhật trạng thái (polling interval bao lâu, hay websocket) → tới khi hiển thị "sẵn sàng". Ghi lại tổng thời gian từ upload xong tới khi sẵn sàng.
5. Vào trang chi tiết tài liệu, xác nhận số chương/mục hiển thị khớp với PDF gốc (đếm tay số chương trong PDF, so sánh).

**B2. Upload PDF scan**
1. Upload `sample_scan.pdf`. Vì khó extract text, kiểm tra hệ thống xử lý thế nào: có OCR không, hay báo lỗi rõ ràng "không đọc được nội dung"?
2. Nếu xử lý được nhưng chất lượng thấp: thử chat hỏi 1 câu về nội dung, xem câu trả lời có hợp lý không — nếu không, ghi vào báo cáo như một giới hạn đã biết (known limitation), không phải bug, để báo trước cho khách hàng.

**B3. Upload file tên đặc biệt**
1. Upload `sample_vietnamese_ký_tự_đặc_biệt (1).pdf`.
2. Xác nhận tên file hiển thị đúng không bị lỗi encoding (không ra `%20` hay ký tự lạ), file lưu trong MinIO vẫn truy xuất được bình thường.

**B4. Upload file hỏng**
1. Upload `sample_corrupt.pdf`.
2. Mong đợi: job xử lý fail có kiểm soát, UI hiển thị trạng thái lỗi rõ ràng cho người dùng (không phải kẹt mãi ở "đang xử lý"), tài liệu lỗi có thể xoá được từ UI.

**B5. Upload file vượt giới hạn**
1. Upload `sample_huge.pdf` (xác nhận trước giới hạn cụ thể trong config, VD `MAX_FILE_SIZE`).
2. Mong đợi UI chặn ngay ở phía client trước khi gửi request nặng (tốt nhất), hoặc server trả lỗi 413 rõ ràng nếu chặn phía server.

**B6. Danh sách / chi tiết / xoá**
1. Vào danh sách tài liệu, xác nhận đầy đủ, đúng thứ tự (mới nhất trước hay cũ nhất trước — ghi rõ hành vi thật).
2. Xoá 1 tài liệu → UI cập nhật ngay không cần F5. Sau đó F5 thật để xác nhận xoá thật ở backend (không phải chỉ ẩn ở client). Kiểm tra thêm trong MinIO console (nếu truy cập được) xác nhận object cũng bị xoá, không để rác.

---

### Module C — Chat có Citation (`test/browser-chat-citation`)

**C1. Hỏi câu có trong tài liệu**
1. Vào tài liệu `sample_clean.pdf`, mở chat, hỏi 1 câu chắc chắn có câu trả lời trong PDF (chuẩn bị sẵn câu hỏi + câu trả lời đúng để đối chiếu tay).
2. Ghi lại request tạo conversation (nếu là lần đầu) và request gửi message. Kiểm tra response có field citation trỏ đúng chunk/trang.
3. Trên UI, bấm vào citation → xác nhận nhảy tới đúng vị trí trong tài liệu gốc (hoặc hiển thị đúng đoạn trích).
4. Đối chiếu nội dung câu trả lời với PDF gốc bằng mắt, xác nhận không bịa thông tin (hallucination).

**C2. Hỏi câu KHÔNG có trong tài liệu**
1. Hỏi 1 câu hoàn toàn không liên quan đến nội dung PDF.
2. Xác nhận hệ thống trả lời kiểu "không tìm thấy thông tin trong tài liệu" thay vì bịa ra câu trả lời sai.

**C3. Câu hỏi biên (edge case)**
1. Gửi message rỗng → xác nhận UI chặn không gửi API, hoặc API trả lỗi validation rõ ràng.
2. Gửi message rất dài (copy nguyên 1 trang PDF paste vào) → xác nhận không crash, có xử lý giới hạn độ dài hợp lý.
3. Gửi câu hỏi bằng tiếng Anh cho tài liệu tiếng Việt (và ngược lại nếu có) → ghi nhận hành vi thật.

**C4. Nhiều lượt hội thoại (multi-turn)**
1. Hỏi câu 1, sau đó hỏi câu 2 có tham chiếu ngữ cảnh câu 1 (VD "còn phần trước đó thì sao?") → xác nhận hệ thống hiểu ngữ cảnh trước, không trả lời như hội thoại mới hoàn toàn.

---

### Module D — Tóm tắt (`test/browser-summary`)

**D1. Tóm tắt toàn bộ tài liệu, đo cache**
1. Bấm tóm tắt full doc lần 1 → ghi lại thời gian phản hồi (cột Time), đọc kỹ nội dung tóm tắt xem có phản ánh đúng các chương chính không.
2. Bấm lại lần 2 (cùng tài liệu, không sửa gì) → ghi lại thời gian phản hồi lần 2, so sánh với lần 1 — nếu cache hoạt động đúng, lần 2 phải nhanh hơn RÕ RỆT (không chỉ nhanh hơn chút do mạng).
3. Nếu có sửa/xoá tài liệu rồi tóm tắt lại → xác nhận cache bị invalidate đúng (không trả tóm tắt cũ sai).

**D2. Tóm tắt theo chương**
1. Chọn 1 chương cụ thể, tóm tắt → đối chiếu tay với nội dung chương đó, xác nhận không lẫn nội dung chương khác vào.

---

### Module E — Quiz (`test/browser-quiz`)

**E1. Sinh quiz nhiều lần, đo tỉ lệ lỗi**
1. Sinh quiz cho `sample_clean.pdf` tối thiểu 10 lần liên tiếp (xoá quiz cũ hoặc sinh mới mỗi lần nếu hệ thống cho phép).
2. Với mỗi lần: xác nhận số câu hỏi đúng như cấu hình, mỗi câu có đủ đáp án + có đúng 1 đáp án đúng được đánh dấu (kiểm tra ở phía đã làm bài, không nhìn thấy đáp án trước khi làm).
3. Ghi lại số lần phải retry ngầm (nếu quan sát được qua Network — có request lặp lại bất thường không) và tổng thời gian sinh quiz trung bình.

**E2. Làm quiz và nộp**
1. Làm hết 1 bài quiz với đáp án đã biết trước (chọn cố tình 1 nửa đúng, 1 nửa sai), nộp bài.
2. Đối chiếu điểm hiển thị với số câu đúng đã chọn thật — phải khớp 100%.

---

### Module F — Đề thi & Chấm điểm (`test/browser-exam-grading`)

**F1. Lấy đề thi, kiểm tra không lộ đáp án — QUAN TRỌNG NHẤT, kiểm tra kỹ**
1. Bấm "làm đề thi" → mở Network tab, tìm đúng request lấy đề (mode=take hoặc tương đương).
2. Copy toàn bộ raw response (Response tab, không phải Preview đã format), paste vào file text, tìm kiếm (Ctrl+F) các từ khoá: `answer`, `correct`, `key`, `solution` — xác nhận không có field nào chứa đáp án đúng lộ ra, kể cả field bị đặt tên khác thường (VD field lạ không có trong tài liệu API).
3. Thử sửa param trên URL (nếu có, VD đổi `mode=take` thành giá trị khác) trực tiếp qua thanh địa chỉ hoặc replay request qua DevTools → xác nhận server chặn đúng, không trả đáp án dù request bị sửa.

**F2. Double-click nộp bài**
1. Làm xong đề, double-click thật nhanh vào nút nộp bài.
2. Kiểm tra Network tab xem có 2 request nộp bài được gửi không → nếu có, xác nhận backend chỉ xử lý 1 lần (idempotent) hoặc request thứ 2 bị từ chối rõ ràng, điểm số không bị tính sai/tính đôi.

**F3. Chấm điểm & feedback**
1. Nộp bài với đáp án đã biết trước (ghi rõ câu nào đúng/sai/để trống/chọn nhiều nếu UI cho phép).
2. Đối chiếu điểm hiển thị với tính tay 100%.
3. Đọc kỹ `explanation_for_wrong` và `ai_feedback` của từng câu sai — xác nhận feedback đúng nói về câu đó (không lệch sang câu khác), nội dung hợp lý không bịa.

**F4. Refresh giữa chừng khi đang làm bài**
1. Đang làm đề thi (chưa nộp), bấm F5 reload trang.
2. Xác nhận: bài làm dở có được giữ lại không (nếu spec yêu cầu), hay ít nhất không bị lỗi/crash, không tự động tính là nộp bài.

---

### Module G — Tutor & Rate Limiting (`test/browser-tutor-ratelimit`)

**G1. Hỏi tutor trong và ngoài phạm vi**
1. Hỏi câu liên quan tài liệu đã upload → xác nhận trả lời có liên hệ đúng ngữ cảnh.
2. Hỏi câu hoàn toàn ngoài phạm vi (VD hỏi về thời tiết) → xác nhận hệ thống xử lý hợp lý (từ chối lịch sự hoặc trả lời chung, tuỳ thiết kế), không bịa thông tin sai liên quan học tập.

**G2. Rate limit qua UI thật**
1. Bấm liên tục hành động bị giới hạn (VD gửi câu hỏi tutor) thật nhanh vượt ngưỡng đã cấu hình (kiểm tra ngưỡng thật trong config trước).
2. Xác nhận UI hiển thị thông báo dễ hiểu ("bạn thao tác quá nhanh, vui lòng thử lại sau X giây") thay vì lỗi kỹ thuật khó hiểu hoặc màn hình trắng.
3. Đợi hết thời gian giới hạn, thử lại → xác nhận hoạt động bình thường trở lại đúng thời điểm.

---

### Module H — Cách ly dữ liệu đa người dùng (`test/browser-isolation`)

**H1. Toàn luồng song song 2 user**
1. Mở 2 cửa sổ trình duyệt riêng biệt (hoặc 1 cửa sổ thường + 1 ẩn danh) đăng nhập `qa_user_a` và `qa_user_b`.
2. Cả 2 cùng upload tài liệu khác nhau, cùng chat, cùng làm quiz/exam gần như đồng thời.
3. Xác nhận: user A không bao giờ thấy tài liệu/conversation/kết quả của user B ở bất kỳ màn hình nào (danh sách tài liệu, lịch sử chat, danh sách quiz/exam, kết quả).
4. Thử truy cập trực tiếp bằng URL (nếu tài nguyên có ID trong URL, VD `/documents/123`) — user A sửa URL để trỏ tới ID tài liệu của user B → xác nhận bị chặn (403/404), không hiển thị dữ liệu.

---

## 3. Kiểm thử đa trình duyệt (bắt buộc cho luồng chính trước bàn giao)

- [ ] Chạy lại A1, B1, C1, F1, F3 trên trình duyệt thứ 2 (khác Chrome) — ghi nhận khác biệt nếu có (giao diện lệch, tính năng không hoạt động)

---

## 4. Kiểm thử khả năng phục hồi (resilience) — mô phỏng sự cố thật

- [ ] Đang upload dở, tắt MinIO container (`docker stop`) → xác nhận UI báo lỗi rõ, không treo vô hạn; bật lại container, thử lại thành công
- [ ] Đang chat, tắt Redis container → xác nhận job hàng đợi liên quan không bị mất hoàn toàn, hệ thống phục hồi khi Redis bật lại
- [ ] Tắt mạng trình duyệt (Network → Offline trong DevTools) giữa lúc đang gửi request → xác nhận UI báo lỗi mất kết nối, không hiển thị sai trạng thái thành công

---

## 5. Câu hỏi cần hỏi người dùng trước khi bắt đầu

- [x] URL/cổng chính xác của frontend hiện tại? => **Xác nhận qua kiểm thử: http://localhost:3001**
- [x] Giới hạn dung lượng file upload cụ thể là bao nhiêu (để chuẩn bị `sample_huge.pdf` đúng)? => **Xác nhận trong config: 50MB (52,428,800 bytes)**
- [x] Ngưỡng rate limit cụ thể (bao nhiêu request/phút) để test đúng? => **Xác nhận trong app.ts: 200 request/phút**
- [x] Có tài liệu API/spec chính thức nào để đối chiếu response ngoài `docs/SmartStudy_AI_Requirements_v2.md` không? => **Chọn: Chỉ sử dụng docs/SmartStudy_AI_Requirements_v2.md và thiết kế trong code làm chuẩn**
- [x] Bản báo cáo cuối `docs/HANDOFF_TEST_REPORT.md` có cần theo mẫu/template riêng của công ty để gửi khách hàng không? => **Chọn: Dùng đúng cấu trúc 6 mục chuẩn chuyên nghiệp quy định tại mục 7 của BROWSER_TEST_GOAL.md**

---

## 6. Mẫu Biên bản kiểm thử (dùng cho mỗi bước ở mục 2)

| # | Module | Bước | Request | Status | Thời gian (ms) | Kết quả UI | PASS/FAIL | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| A1 | Auth | Đăng ký thành công | POST /auth/register | | | | | |
| A2 | Auth | Đăng ký trùng email | POST /auth/register | | | | | |
| ... | | | | | | | | |

(Điền đầy đủ cho từng bước con của mọi module — copy bảng này ra file riêng nếu quá dài để giữ GOAL này gọn.)

---

## 7. Cấu trúc báo cáo bàn giao (`docs/HANDOFF_TEST_REPORT.md`)

Bắt buộc có các phần sau, viết cho khách hàng đọc được (không quá kỹ thuật):
1. **Tóm tắt điều hành** — hệ thống đã test bao nhiêu module, kết quả tổng quan, có sẵn sàng bàn giao hay còn điểm cần lưu ý
2. **Phạm vi đã test** — liệt kê 8 module + các luồng chính
3. **Kết quả chi tiết** — bảng tổng hợp PASS/FAIL từng module (rút gọn từ mục 6/8)
4. **Giới hạn đã biết (known limitations)** — VD chất lượng xử lý PDF scan, không có captcha chống brute-force, v.v. — liệt kê rõ để khách hàng không bất ngờ sau này
5. **Bug đã phát hiện và đã fix** — liệt kê kèm PR liên quan
6. **Khuyến nghị trước khi vận hành thật** (nếu có, VD: nên bật rate limit chặt hơn, nên có giám sát log, backup định kỳ)

---

## 8. Test Matrix tổng hợp

| Module | Số bước con đã test | PASS | FAIL | Bug đã fix | Trạng thái tổng |
|---|---|---|---|---|---|
| Auth | 5 | | | | ⬜ |
| Documents/Upload | 6 | | | | ⬜ |
| Chat/Citation | 4 | | | | ⬜ |
| Summary | 2 | | | | ⬜ |
| Quiz | 2 | | | | ⬜ |
| Exam/Grading | 4 | | | | ⬜ |
| Tutor/Rate limit | 2 | | | | ⬜ |
| Isolation đa user | 1 | | | | ⬜ |
| Đa trình duyệt | 5 | | | | ⬜ |
| Resilience | 3 | | | | ⬜ |

(Trạng thái: ⬜ Chưa chạy / 🟡 Đang chạy / ✅ PASS toàn bộ / ❌ Còn FAIL / 🚧 BLOCKED)

---

## 9. Định nghĩa "Sẵn sàng bàn giao"

Chỉ được coi là sẵn sàng bàn giao khi:
- [ ] Toàn bộ mục 2, 3, 4 đã chạy, Test Matrix mục 8 toàn bộ ✅ hoặc FAIL đã có lý do rõ ràng ghi vào "giới hạn đã biết"
- [ ] `docs/HANDOFF_TEST_REPORT.md` đã viết xong, đã tự đọc lại như thể mình là khách hàng để xác nhận dễ hiểu
- [ ] Không còn bug nghiêm trọng (chặn luồng chính, lộ dữ liệu, sai điểm số) chưa fix
- [ ] Đã xoá sạch dữ liệu test (`qa_user_a`, `qa_user_b`, các file mẫu) khỏi môi trường sẽ bàn giao, hoặc đã thông báo rõ đây là dữ liệu demo nếu khách hàng muốn giữ lại để xem
