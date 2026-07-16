# SmartStudy Cloudflare AI Relay

## Mục đích

Relay cung cấp một URL cố định luôn tồn tại trên Internet:

```text
https://smartstudy-ai-relay.dcthanh-a1-c3tqcap.workers.dev
```

Luồng xử lý:

```text
AWS Lambda
  -> Cloudflare Worker + Durable Object
  -> WebSocket outbound từ máy local
  -> Ollama 127.0.0.1:11434
```

Cloudflare Worker vẫn hoạt động khi máy local tắt. Endpoint `/health` trả
`agentConnected: false` và request AI trả mã `503` với `AI_OFFLINE`. Khi local
agent kết nối lại, URL không thay đổi và request được chuyển tới Ollama.

## Bật AI local

1. Mở Ollama và bảo đảm model tồn tại:

   ```powershell
   ollama list
   ```

2. Từ thư mục dự án chạy:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-cloudflare-ai-relay.ps1
   ```

3. Giữ cửa sổ này mở trong thời gian sử dụng AI. Khi thấy dòng sau, máy đã kết
   nối tới relay:

   ```text
   SmartStudy local AI is connected to the Cloudflare relay.
   ```

4. Tắt local agent bằng `Ctrl+C`. URL Worker vẫn tồn tại nhưng báo AI offline.

Script lấy agent key từ AWS Systems Manager Parameter Store tại:

```text
/smartstudy/production/cloudflare-relay-agent-key
```

Không ghi agent key vào source code, ảnh chụp hoặc tài liệu.

## Kiểm tra trạng thái

```powershell
Invoke-RestMethod `
  -Uri "https://smartstudy-ai-relay.dcthanh-a1-c3tqcap.workers.dev/health"
```

Khi AI đang bật:

```json
{
  "status": "ok",
  "agentConnected": true
}
```

Khi máy local hoặc agent đang tắt:

```json
{
  "status": "ok",
  "agentConnected": false
}
```

## Secrets

Cloudflare Worker sử dụng hai secret:

- `RELAY_API_KEY`: xác thực request từ AWS Lambda.
- `RELAY_AGENT_KEY`: xác thực local relay agent.

Các giá trị thật được quản lý bằng Cloudflare Worker Secrets và AWS SSM SecureString.
Không đưa secret vào `wrangler.jsonc`, `.env`, Git hoặc tài liệu.

## Deploy Worker

Chỉ deploy sau khi thay đổi đã đi qua PR theo quy trình team:

```powershell
Set-Location .\cloudflare-relay
npm ci
npm run typecheck
npm test
npm run build
npm run deploy
```

## Rollback

1. Đổi `LLAMA_CPP_BASE_URL` trên AWS về endpoint trước đó.
2. Deploy lại CloudFormation từ commit `main` đã biết là ổn định.
3. Cloudflare Worker có thể giữ nguyên để điều tra; không xóa secret khi chưa
   xác nhận rollback thành công.
