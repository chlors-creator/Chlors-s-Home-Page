# Chlors Presence Worker

独立的 Durable Object 在线状态 API。部署前在 Cloudflare Worker 设置中绑定域名（建议 `status.chlors.cn`），并设置密钥：

```powershell
npx wrangler secret put STATUS_REPORT_TOKEN
npx wrangler deploy
```

API：`GET /api/status`、`POST /api/status`。POST 使用 `Authorization: Bearer <token>`。

默认只允许 `https://chlors.cn` 和 `https://www.chlors.cn` 作为浏览器跨域来源。如主站使用其他域名，请在 Worker 的非敏感变量中设置 `PUBLIC_SITE_ORIGINS`，多个来源用逗号分隔；状态上报器使用 HTTPS，不依赖 CORS。

使用 `status-reporter/install.ps1` 配置上报器。脚本会把 Token 以当前 Windows 用户可解密的 DPAPI 形式保存在 `%LOCALAPPDATA%\NaichunSitePresenceReporter\settings.json`，不再把明文 Token 写入项目目录的 `config.json`。
