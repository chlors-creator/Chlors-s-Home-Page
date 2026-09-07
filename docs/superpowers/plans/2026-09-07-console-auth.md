# 控制台认证与上传实施计划

**Goal:** 为 Astro 个人网站增加环境变量认证的控制台，支持受保护的文章与 MP3 上传。

### Task 1: 会话与认证工具
- 新增 `functions/api/auth.ts`，实现登录、登出、会话校验。
- 使用 `ADMIN_USERNAME`、`ADMIN_PASSWORD`，Cookie 使用 HttpOnly、Secure、SameSite=Lax。

### Task 2: 受保护上传接口
- 修改 `functions/api/publish.ts`，改用会话校验，不再接受前端密码。
- 新增 `functions/api/upload-music.ts`，校验目录白名单与 MP3 类型，使用 GitHub Contents API 上传。

### Task 3: 控制台与导航
- 新增 `src/pages/console.astro` 与客户端脚本，提供登录、文章、音乐上传和退出。
- 主页右上角增加控制台入口，移除专题页导入入口。

### Task 4: 测试与验证
- 新增认证和标记测试，运行 `npm test`、`npm run build`。
