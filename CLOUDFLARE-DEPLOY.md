# Cloudflare Pages 发布配置

在 Cloudflare Pages 项目的 Settings -> Environment variables 添加：

- `GITHUB_TOKEN`：Fine-grained token，仅授予目标仓库 `Contents: Read and write`
- `GITHUB_OWNER`：GitHub 用户名或组织名
- `GITHUB_REPO`：仓库名
- `GITHUB_BRANCH`：通常为 `main`
- `ADMIN_PASSWORD`：文章发布页管理员密码

部署后访问 `/editor/`，选择 Markdown 正文、填写元数据并点击“发布到网站”。Function 会将文件写入 `src/content/posts/`，GitHub push 会自动触发 Cloudflare Pages 构建。

## 本地状态上报

1. 在 Cloudflare Pages 项目的 KV bindings 中创建变量 `STATUS_KV` 并绑定一个 KV namespace。
2. 在 Environment variables 中添加加密变量 `STATUS_REPORT_TOKEN`，值使用一段足够长的随机字符串。
3. 部署网站后，以普通用户身份运行 `status-reporter/install.ps1`，输入网站地址和同一个 token。
4. 安装器会创建登录时启动的计划任务 `NaichunSitePresenceReporter`。运行 `status-reporter/uninstall.ps1` 可移除它。

状态程序仅上传 Steam 客户端是否运行、网易云媒体会话的播放状态、歌曲名和上报时间。超过 45 秒没有上报时，网站自动显示离线。
