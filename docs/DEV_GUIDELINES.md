# SmartStudy AI — Development Guidelines

## 1. Quy trình Git

### 1.1 Nhánh

- `main`: phiên bản ổn định.
- `develop`: nhánh tích hợp, phải luôn chạy được.
- Mỗi task bắt đầu từ `develop` trên nhánh
  `feature/<phase>-<mo-ta-ngan>`; lỗi sau merge dùng `bugfix/...`.
- Một nhánh và một pull request chỉ giải quyết một task trong `GOAL.md`.

### 1.2 Conventional Commits

Commit dùng định dạng:

```text
<type>(<scope>): <subject>
```

`type` hợp lệ: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
`scope` ưu tiên tên module: `auth`, `documents`, `chat`, `summary`, `quiz`,
`exam`, `grading`, `tutor`, `core`, `db`, `ci`, `observability`, `infra`.
Subject dùng câu mệnh lệnh, ngắn gọn, không kết thúc bằng dấu chấm.

### 1.3 Pull request@

PR phải dùng template của repository và có:

- Mô tả phạm vi cùng lý do thay đổi.
- Liên kết đúng task trong `GOAL.md`.
- Cách kiểm thử có thể lặp lại.
- Checklist lint, test, coverage, security và tài liệu.
- Không chứa thay đổi ngoài phạm vi task.

## 2. Quy ước code

- TypeScript strict; không dùng `any` nếu không có giải thích.
- Tên file TypeScript dùng `kebab-case`; interface/type/class dùng PascalCase;
  biến và hàm dùng camelCase; hằng số môi trường dùng UPPER_SNAKE_CASE.
- Import theo thứ tự: thư viện ngoài, alias nội bộ, relative; ngăn nhóm bằng
  một dòng trống.
- Controller chỉ xử lý HTTP; business rule nằm trong service/use case.
- Business logic chỉ phụ thuộc interface trong `backend/src/ports/`, không
  import adapter hoặc SDK nhà cung cấp.
- Validate mọi input tại boundary và trả lỗi có cấu trúc, không làm lộ secret.

## 3. Review

### 3.1 Checklist tự review

- Phạm vi PR khớp đúng một task và không có file phát sinh ngoài ý muốn.
- Luồng thành công, lỗi và edge case quan trọng đều được kiểm thử.
- Không gọi SDK cụ thể trong business logic; dependency đi qua port.
- Query dữ liệu luôn kiểm tra ownership của người dùng.
- Không log token, password, API key hay dữ liệu nhạy cảm.
- Migration có thể chạy lặp lại trên database sạch.
- Tên, cấu trúc, import và error handling tuân thủ tài liệu này.

## 4. Testing

### 4.1 Coverage

- Business logic mới phải có unit test và coverage tối thiểu 80%.
- Hàm chấm điểm/so sánh đáp án phải đạt 100%.
- Adapter tích hợp được test bằng dependency giả hoặc service local; CI không
  gọi API LLM, email hay cloud thật.
- Mỗi bugfix phải có regression test chứng minh lỗi đã được chặn.

## 5. Chất lượng

Trước commit phải chạy thành công lint, typecheck và test. Warning được xem là
lỗi trong CI. Không commit output build, coverage, dependency hoặc runtime data.

## 6. Bảo mật

### 6.4 Security checklist

- Không commit secret; chỉ cung cấp placeholder trong `.env.example`.
- Password dùng bcrypt cost tối thiểu 12; không log hoặc trả password hash.
- Access token có TTL ngắn; refresh token được hash, có hạn dùng và thu hồi.
- Mọi endpoint riêng tư xác thực JWT và kiểm tra ownership phía server.
- File upload kiểm tra loại, kích thước và key do server tạo.
- LLM prompt/context không được cho phép truy cập dữ liệu người dùng khác.
- Dependency và container image phải được kiểm tra lỗ hổng định kỳ.

## 10. Definition of Done

### 10.1 Cấp task

Task chỉ hoàn thành khi lint, typecheck, unit test và coverage đạt yêu cầu; PR
được tự review theo mục 3.1; không có secret; tài liệu liên quan được cập nhật;
và PR đã merge vào `develop`.
