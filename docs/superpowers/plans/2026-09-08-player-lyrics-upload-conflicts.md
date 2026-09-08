# 播放器展开、实时歌词与上传冲突处理实施计划

> **供新对话中的执行代理使用：** 必须按阶段顺序执行。每个阶段采用测试先行，并在阶段结束后向用户报告结果；不要一次性混合修改所有模块。

**目标：** 为歌单播放器增加不遮挡左侧菜单栏的展开模式和实时滚动歌词；控制台允许分别上传 MP3 与 LRC，并在同名文件存在时由用户明确选择覆盖或取消上传。

**架构：** 构建脚本根据同目录、同基础文件名自动匹配 MP3 与 LRC，并把 `lyricsSrc` 写入音乐清单。浏览器端用独立纯函数解析 LRC，用 AmplitudeJS 音频时间驱动歌词高亮；上传接口使用结构化 `409 Conflict` 响应触发前端冲突弹窗，覆盖操作必须再次读取 GitHub 文件 SHA。

**技术栈：** Astro 5、TypeScript、AmplitudeJS、Cloudflare Pages Functions、GitHub Contents API、CSS、Node.js 内置测试运行器。

**需求基线：** 本文件即完整需求与实施基线，新对话不依赖此前聊天记录。

## 全局约束

- 工作目录是 `C:\Users\乃春_Chlors\Documents\ChatGPT\个人网站`。
- 默认只修改《个人网站》；只有用户明确说“同步”时，才复制相关文件到 `C:\Users\乃春_Chlors\Documents\ChatGPT\Chlors-s-Home-Page`。
- 不自动提交、不推送 GitHub；除非用户在新对话中另行要求。
- 不引入新 npm 包或新测试框架，继续使用 `node --test tests`。
- MP3 与 LRC 分别上传，上传顺序不限。
- 自动匹配规则：同一歌单目录、去除扩展名后名称一致；英文字母大小写可忽略，空格、中文、数字和标点必须一致。
- 没有匹配 LRC、LRC 内容为空或无法解析时，显示“纯音乐，请欣赏”。
- 同名文件存在时绝不默认覆盖；用户选择“保留原文件”后直接取消本次上传，不改名、不创建副本。
- 展开播放器只覆盖主内容区域，不覆盖桌面端左侧菜单栏。
- 冲突弹窗同样只覆盖主内容区域；弹出时锁定主内容滚动。
- 所有动画必须支持 `prefers-reduced-motion: reduce`。
- 页面使用 Astro 客户端导航，新增监听器必须在 `astro:before-swap` 时清理，避免重复绑定。

## 已确认的用户体验

### 播放器展开

- 在播放器右上角增加图标式展开按钮，并提供 `title` 与 `aria-label`。
- 点击后播放器从原位置经过动画扩大，占满主内容区域；左侧菜单栏继续显示。
- 原播放器标题、歌手、模式、上一首、播放/暂停、下一首、音量和进度条在展开区域顶部保持原有结构与状态。
- 下方显示实时滚动歌词；当前行高亮，前后歌词弱化。
- 再次点击按钮或按 `Esc` 收起播放器，并恢复页面滚动。
- 切歌和拖动进度后，歌词立即同步。

### 上传冲突弹窗

- 顶部显示“文件已存在”，下方是一条横向分割线。
- 内容区左右两列：左侧“待上传文件”，右侧“已存在文件”。
- 两侧均显示文件名、格式化大小和类型（`MP3 音频` 或 `LRC 歌词`）。
- 底部左侧为“覆盖”，右侧为“保留原文件”，均为细边线直角矩形按钮。
- “覆盖”悬停时背景和边线变红，以屏幕中线一侧为轴向左外翻：`transform-origin: right center`、负 `rotateY`。
- “保留原文件”悬停时背景和边线变绿，以对称方式向右外翻：`transform-origin: left center`、正 `rotateY`。
- `Esc`、遮罩关闭和“保留原文件”都取消本次上传。
- 弹窗需要焦点管理：打开后聚焦第一个操作按钮，`Tab` 不应跑到弹窗外部，关闭后焦点返回触发上传的按钮。

## 文件职责图

- `scripts/build-music-library.mjs`：扫描 MP3、匹配同名 LRC、生成 `lyricsSrc`。
- `src/generated/music-library.json`：构建生成的歌曲清单，不手工维护除验证构建结果外的数据。
- `src/scripts/lrc.ts`：LRC 解析和当前歌词索引计算的纯函数。
- `src/components/MusicPlayer.astro`：展开按钮、歌词容器和可访问性标记。
- `src/scripts/music-player.ts`：展开/收起、歌词加载缓存、播放时间同步和清理。
- `src/styles/music-player.css`：播放器展开布局、FLIP 动画后的终态、歌词视觉与响应式规则。
- `functions/api/upload-music.ts`：MP3/LRC 校验、GitHub 冲突检测和显式覆盖。
- `src/pages/console.astro`：两个独立上传表单和冲突对话框结构。
- `src/scripts/console.ts`：上传状态机、冲突信息渲染、覆盖重试和取消逻辑。
- `src/styles/content.css`：控制台上传表单和冲突弹窗样式。
- `tests/lrc.test.mjs`：LRC 纯函数行为。
- `tests/music-library.test.mjs`：同名 LRC 匹配与清单数据。
- `tests/player-markup.test.mjs`：展开按钮和歌词区域标记。
- `tests/console-navigation.test.mjs`：独立上传表单、冲突弹窗和接口契约。

---

## 阶段一：歌词数据管线与 LRC 解析

**可独立验收结果：** 构建生成的每首歌曲包含 `lyricsSrc: string | null`，并具备经过测试的 LRC 解析与当前行定位函数；播放器界面暂不展示歌词。

**文件：**

- 新建：`src/scripts/lrc.ts`
- 新建：`tests/lrc.test.mjs`
- 修改：`scripts/build-music-library.mjs`
- 修改：`tests/music-library.test.mjs`
- 生成：`src/generated/music-library.json`

**接口：**

```ts
export interface LyricLine {
  time: number;
  text: string;
}

export function parseLrc(source: string): LyricLine[];
export function findActiveLyricIndex(lines: LyricLine[], currentTime: number): number;
```

歌曲清单中的 Track 增加：

```ts
lyricsSrc: string | null;
```

- [ ] **步骤 1：先写 LRC 解析失败测试**

  覆盖 `[00:12.50]歌词`、一行多个时间戳、元数据行、`[offset:500]`、无时间戳文本、排序以及播放时间位于第一句之前时返回 `-1`。

- [ ] **步骤 2：运行测试并确认因模块不存在而失败**

  运行：`node --test tests/lrc.test.mjs`

- [ ] **步骤 3：实现最小 LRC 纯函数**

  `parseLrc` 只支持标准分钟、秒和百分秒/毫秒时间标签；忽略 `[ar:]`、`[ti:]` 等元数据。多时间戳展开为多行并按时间升序排列。`findActiveLyricIndex` 使用二分查找，避免每次 `timeupdate` 从头扫描。

- [ ] **步骤 4：测试解析器通过**

  运行：`node --test tests/lrc.test.mjs`

- [ ] **步骤 5：先写同名匹配失败测试**

  在临时歌单目录准备可识别的 MP3 测试夹具与 `Song.lrc`，断言 `song.mp3` 获得编码后的 `/music/<playlist>/Song.lrc`；同时断言不同标点或额外后缀不会匹配。若仓库没有有效 MP3 夹具，导出并单测一个纯函数：

  ```js
  export function findMatchingLrc(mp3Path, lrcPaths) {
    // 返回匹配路径或 null
  }
  ```

- [ ] **步骤 6：运行测试并确认缺少 `lyricsSrc` 或匹配函数而失败**

  运行：`node --test tests/music-library.test.mjs`

- [ ] **步骤 7：修改音乐库构建脚本**

  每个歌单目录递归收集 `.lrc`，用 `basename(path, extname(path)).toLocaleLowerCase('en-US')` 建立索引。只在同一相对子目录中匹配，避免不同专辑目录的同名歌曲串歌词。URL 必须复用现有 `encodeUrlPath`。

- [ ] **步骤 8：生成清单并运行阶段测试**

  运行：

  ```powershell
  npm run music:build
  node --test tests/lrc.test.mjs tests/music-library.test.mjs
  ```

---

## 阶段二：MP3/LRC 独立上传与服务端冲突协议

**可独立验收结果：** 接口接受 `.mp3` 或 `.lrc`；新文件正常上传，同名文件返回包含两侧文件信息的 `409`，只有显式 `overwrite=true` 才覆盖。

**文件：**

- 修改：`functions/api/upload-music.ts`
- 修改：`tests/console-navigation.test.mjs`，或新建 `tests/upload-music.test.mjs` 进行请求级测试

**接口契约：**

普通成功：

```json
{ "ok": true, "path": "public/music/vocaloid/song.lrc" }
```

冲突响应，HTTP 状态必须为 `409`：

```json
{
  "error": "file_exists",
  "message": "文件已存在",
  "incoming": { "name": "song.lrc", "size": 2048, "type": "LRC 歌词" },
  "existing": { "name": "song.lrc", "size": 1800, "type": "LRC 歌词" },
  "path": "public/music/vocaloid/song.lrc"
}
```

覆盖请求仍使用 `multipart/form-data`，额外包含：

```text
overwrite=true
```

- [ ] **步骤 1：编写接口失败测试**

  模拟认证成功和 GitHub Contents API：验证 `.lrc` 可上传、非法扩展名返回 `400`、已存在且未指定覆盖返回 `409`、选择覆盖时 PUT 请求携带刚重新读取到的 `sha`。

- [ ] **步骤 2：运行测试并确认当前接口因只接受 MP3且默认覆盖而失败**

  运行：`node --test tests/upload-music.test.mjs`

- [ ] **步骤 3：重构上传接口为清晰的分步逻辑**

  保留目录白名单；允许 `.mp3` 和 `.lrc`。根据扩展名生成显示类型，不信任客户端 MIME。先 GET GitHub 文件：存在且 `overwrite` 不为 `true` 时返回 `409`；覆盖时再次使用当前响应中的 SHA 发 PUT。不存在时不携带 SHA。

- [ ] **步骤 4：避免大 MP3 的 base64 展开栈溢出**

  将当前 `btoa(String.fromCharCode(...bytes))` 改为分块编码，例如每块 `0x8000` 字节再拼接字符串，保持 GitHub Contents API 所需 base64 格式。

- [ ] **步骤 5：处理覆盖竞态**

  GitHub PUT 返回 `409` 时，向前端返回明确错误“文件在确认期间已发生变化，请重新上传”，不要静默重试或使用旧 SHA。

- [ ] **步骤 6：运行接口测试和全套测试**

  运行：

  ```powershell
  node --test tests/upload-music.test.mjs
  npm test
  ```

---

## 阶段三：控制台独立上传表单与冲突弹窗

**可独立验收结果：** 控制台分别上传 MP3 和 LRC；文件冲突时出现指定弹窗，“覆盖”重试上传，“保留原文件”立即取消。

**文件：**

- 修改：`src/pages/console.astro`
- 修改：`src/scripts/console.ts`
- 修改：`src/styles/content.css`
- 修改：`tests/console-navigation.test.mjs`

**前端状态：**

```ts
interface PendingUpload {
  formData: FormData;
  submitButton: HTMLButtonElement;
}

let pendingUpload: PendingUpload | null = null;
```

- [ ] **步骤 1：编写标记和交互契约失败测试**

  断言页面包含 `[data-mp3-form]`、`accept="audio/mpeg,.mp3"`、`[data-lrc-form]`、`accept=".lrc,text/plain"`、`[data-file-conflict]`、两侧文件信息节点、`[data-overwrite]` 和 `[data-keep-existing]`。

- [ ] **步骤 2：运行测试并确认当前单表单结构失败**

  运行：`node --test tests/console-navigation.test.mjs`

- [ ] **步骤 3：拆分两个上传表单**

  两个表单各自包含文件、歌单和提交按钮。沿用同一个 `/api/upload-music` 接口，禁止把 MP3 与 LRC 放入同一个文件选择器。

- [ ] **步骤 4：增加原生 `dialog` 冲突结构**

  使用 `<dialog data-file-conflict>` 获得基础焦点与 `Esc` 行为；内部结构按照“标题 → 分割线 → 左右文件对比 → 底部双按钮”排列。不要把文件内容或账号信息写入 DOM。

- [ ] **步骤 5：实现统一上传函数**

  两个表单调用同一个 `submitMusicForm(form, overwrite = false)`。遇到 `409` 且 `error === 'file_exists'` 时保存原始 `FormData`、渲染冲突信息并打开弹窗。其他错误必须显示在 `[data-console-status]`，不能表现为点击无反应。

- [ ] **步骤 6：实现冲突决策**

  “覆盖”向保留的 `FormData` 设置 `overwrite=true` 后重试；成功后关闭弹窗、清空对应文件输入并显示“音乐已提交”或“歌词已提交”。“保留原文件”、`Esc` 和取消事件均清空 `pendingUpload`，关闭弹窗并显示“已取消上传”。

- [ ] **步骤 7：实现弹窗样式和对称按钮动画**

  桌面端遮罩使用 `position: fixed; inset: 0 0 0 299px`，确保左侧菜单不被覆盖；移动端在 `main` 范围内展示。遮罩使用半透明颜色和 `backdrop-filter: blur(...)`。按钮保持直角细边框；覆盖按钮红色、`transform-origin:right center`、负 `rotateY`，保留按钮绿色、`transform-origin:left center`、正 `rotateY`。在减少动画媒体查询中移除旋转和位移。

- [ ] **步骤 8：运行控制台测试与构建**

  运行：

  ```powershell
  node --test tests/console-navigation.test.mjs tests/upload-music.test.mjs
  npm run build
  ```

---

## 阶段四：播放器展开模式与实时滚动歌词

**可独立验收结果：** 播放器可从原位置动画扩大到主内容区；顶部控制器不变，下方歌词随播放滚动，无歌词时显示固定文案。

**文件：**

- 修改：`src/components/MusicPlayer.astro`
- 修改：`src/scripts/music-player.ts`
- 修改：`src/styles/music-player.css`
- 修改：`tests/player-markup.test.mjs`
- 使用：`src/scripts/lrc.ts`

- [ ] **步骤 1：编写播放器结构失败测试**

  断言组件包含 `[data-expand-player]`、展开/收起可访问标签、`[data-lyrics]`、`[data-lyrics-lines]` 和“纯音乐，请欣赏”。同时断言 Track 类型包含 `lyricsSrc`。

- [ ] **步骤 2：运行测试并确认新结构不存在而失败**

  运行：`node --test tests/player-markup.test.mjs`

- [ ] **步骤 3：增加展开按钮和歌词区域**

  展开按钮放在 `.player-surface` 右上角，使用项目已有图标风格或 Lucide（只有仓库已安装图标库时才用；不要新增依赖）。歌词区域位于原播放器控制区下方，并只在展开状态显示。

- [ ] **步骤 4：实现歌词加载缓存**

  在播放器初始化作用域使用：

  ```ts
  const lyricCache = new Map<string, LyricLine[]>();
  ```

  切歌时根据 `track.lyricsSrc` 请求 LRC、解析并渲染。无地址、HTTP 失败、解析异常或结果为空时统一渲染“纯音乐，请欣赏”；请求失败不得中断播放。

- [ ] **步骤 5：用音频时间驱动歌词**

  在现有 `render()` 中调用 `findActiveLyricIndex(lines, audio.currentTime)`。只有索引变化时更新 `data-active` 和调用 `scrollIntoView({ block: 'center', behavior: 'smooth' })`，避免每次 `timeupdate` 都触发布局。切歌、拖动进度和从头播放时重置索引。

- [ ] **步骤 6：实现播放器 FLIP 展开动画**

  展开前记录播放器矩形，设置 `data-expanded` 后读取终态矩形，用 Web Animations API 从逆变换过渡到 `transform:none`。收起时执行反向动画，完成后再移除固定定位状态。展开终态桌面端使用 `position:fixed; inset:0 0 0 299px`，`z-index` 低于 `.sidebar` 的 `20`，并锁定 `main` 滚动。

- [ ] **步骤 7：补齐键盘、导航和清理行为**

  `Esc` 收起；展开按钮同步 `aria-expanded`、`aria-label` 和 `title`；`astro:before-swap` 清除动画、请求状态、事件监听和滚动锁。不要销毁 Amplitude 音频实例后重建歌曲导致当前播放位置丢失。

- [ ] **步骤 8：实现展开和歌词视觉**

  顶部控制区域沿用现有布局，不因展开而重排核心按钮；歌词区占据剩余高度并允许内部滚动。当前歌词使用 `var(--ink)` 和较高字重，非当前歌词使用 `var(--muted)`；不使用紫色或大面积单色渐变。移动端允许顶部控制区自然换行，歌词不得被按钮遮挡。

- [ ] **步骤 9：运行相关测试和完整测试**

  运行：

  ```powershell
  node --test tests/lrc.test.mjs tests/player-markup.test.mjs tests/playback-modes.test.mjs
  npm test
  ```

---

## 阶段五：集成、浏览器验证与交付

**可独立验收结果：** 从控制台上传到播放器展示的完整流程可用，桌面和移动布局无覆盖、无控制台错误，相关文件可按用户指令同步。

**文件：**

- 仅在发现问题时修改上述阶段文件
- 不在仓库内保存临时截图、测试脚本或浏览器跟踪文件

- [ ] **步骤 1：运行完整自动验证**

  ```powershell
  npm test
  npm run build
  git diff --check
  ```

  构建会更新时间戳，但 `src/generated/music-library.json` 中新增的 `lyricsSrc` 属于必要输出；不要误删。若只有时间戳变化且没有真实音乐数据变化，恢复无关时间戳变更。

- [ ] **步骤 2：启动本地开发环境**

  Pages Functions 需要用能够运行 Functions 的本地命令验证，优先使用项目既有 Wrangler 配置；若只有 `astro dev`，它只能验证播放器页面，不能证明上传接口工作。不要安装新工具，仓库已有 `wrangler` 开发依赖。

- [ ] **步骤 3：浏览器验证播放器流程**

  桌面视口至少 `1440×900`：进入有歌曲的歌单，播放歌曲，点击展开，确认左侧菜单仍可见、播放器顶部不变、歌词滚动、切歌同步、`Esc` 收起。再用约 `390×844` 的移动视口检查无重叠、无横向滚动和文字溢出。

- [ ] **步骤 4：浏览器验证上传冲突流程**

  登录控制台，分别验证 MP3 和 LRC：新文件直接上传；同名文件弹窗显示正确两侧信息；“保留原文件”取消且 GitHub 文件不变；再次触发冲突并选择“覆盖”，确认接口成功且弹窗关闭。验证失败状态会显示文字反馈，不允许“点击没反应”。

- [ ] **步骤 5：检查浏览器错误与可访问性**

  确认没有相关 `error`/`warn`；键盘可操作展开按钮、冲突弹窗和两个决策按钮；减少动画设置下不执行 3D 旋转和 FLIP 位移动画。

- [ ] **步骤 6：最终差异审查**

  只保留本功能涉及的文件；不得清理或覆盖工作区中已有的用户改动。报告实际测试数量、构建结果、浏览器验证视口和任何未验证风险。

- [ ] **步骤 7：按用户指令决定是否同步**

  只有用户明确说“同步”时，将本计划实际修改的文件逐一复制到 `Chlors-s-Home-Page`，随后比较 SHA-256 并在目标仓库运行 `npm test` 和 `npm run build`。不 commit、不 push。

## 新对话启动提示词

在新对话中发送以下内容即可：

```text
请阅读并执行《个人网站》中的实施计划：
C:\Users\乃春_Chlors\Documents\ChatGPT\个人网站\docs\superpowers\plans\2026-09-08-player-lyrics-upload-conflicts.md

严格按五个阶段逐项实施和验证，每完成一个阶段先报告结果再继续。只修改“个人网站”，我明确说“同步”后才同步到 Chlors-s-Home-Page；不要 commit 或 push，不要引入新依赖或测试框架。开始前先检查当前工作区，保留所有既有修改。
```

