# 控制台认证与上传设计

## 目标

为个人网站增加受保护的控制台。主页右上角提供“控制台”入口；普通页面不显示上传入口，认证用户可在 `/console/` 上传文章和 MP3。

## 认证

- 账号和密码来自 Cloudflare Pages 环境变量 `ADMIN_USERNAME`、`ADMIN_PASSWORD`。
- 登录由服务端接口校验，前端不保存密码。
- 成功登录后使用 HttpOnly、Secure、SameSite=Lax Cookie 保存会话。
- 文章与音乐上传接口必须验证会话；未授权返回 401。

## 控制台

`/console/` 提供登录状态和上传表单。未登录显示登录表单；登录后显示文章上传、音乐上传和退出按钮。专题页面不再显示文章上传入口。

## 上传

- 文章上传复用现有 GitHub Contents API，保留 Markdown 元数据字段。
- 音乐上传接收 MP3、歌单目录和文件名，通过 GitHub Contents API 写入 `public/music/<directory>/`。
- 上传成功后重新生成音乐清单；普通访客不能调用上传接口。

## 验证

测试登录成功/失败、Cookie 会话、未授权上传拒绝、授权上传路径校验和控制台构建；运行 `npm test` 与 `npm run build`。
