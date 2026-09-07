# Chlors Presence Worker

独立的 Durable Object 在线状态 API。部署前在 Cloudflare Worker 设置中绑定域名（建议 `status.chlors.cn`），并设置密钥：

```powershell
npx wrangler secret put STATUS_REPORT_TOKEN
npx wrangler deploy
```

API：`GET /api/status`、`POST /api/status`。POST 使用 `Authorization: Bearer <token>`。

把 `status-reporter/config.example.json` 复制为 `config.json`，将 `siteUrl` 填为 Worker 域名。
