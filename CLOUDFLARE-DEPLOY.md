# Cloudflare Pages 发布配置

在 Cloudflare Pages 项目的 Settings -> Environment variables 添加：

- `GITHUB_TOKEN`：Fine-grained token，仅授予目标仓库 `Contents: Read and write`
- `GITHUB_OWNER`：GitHub 用户名或组织名
- `GITHUB_REPO`：仓库名
- `GITHUB_BRANCH`：通常为 `main`
- `ADMIN_PASSWORD`：文章发布页管理员密码

部署后访问 `/editor/`，选择 Markdown 正文、填写元数据并点击“发布到网站”。Function 会将文件写入 `src/content/posts/`，GitHub push 会自动触发 Cloudflare Pages 构建。
