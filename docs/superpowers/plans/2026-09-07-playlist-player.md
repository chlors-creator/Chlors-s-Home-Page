# 歌单播放器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 Astro 网站增加八个自动扫描仓库 MP3 的歌单和基于 AmplitudeJS 的完整自定义播放器。

**Architecture:** Node 构建脚本扫描八个固定目录，用 `music-metadata` 解析 ID3、内嵌封面和时长并生成 JSON。Astro 静态路由读取清单生成索引和八个播放器页面；浏览器端以 AmplitudeJS 为播放内核，自定义维护四种播放模式和界面状态。

**Tech Stack:** Astro 5、TypeScript、AmplitudeJS、music-metadata、Node.js test runner

**Spec:** `docs/superpowers/specs/2026-09-07-playlist-player-design.md`

## 全局约束

- 仅修改“个人网站”；用户明确要求同步时才复制到 `Chlors-s-Home-Page`。
- 八个目录和 slug 必须与设计文档一致，用户只需上传 MP3。
- AmplitudeJS 不加载默认皮肤。
- 空歌单必须可构建、可访问。
- 侧边栏和背景不参与播放器页面切入动画。
- 控件必须支持键盘焦点和中文 ARIA 标签。

---

### Task 1: 分类模型、依赖与目录

**Files:**
- Create: `src/data/playlists.ts`
- Create: `public/music/{electronic,japanese-pop,chinese-pop,post-rock-punk,phonk,math-rock,midwest-emo,piano}/.gitkeep`
- Modify: `package.json`, `package-lock.json`
- Test: `tests/playlists.test.mjs`

**Interfaces:**
- Produces `PLAYLISTS: readonly PlaylistDefinition[]` and `getPlaylist(slug)`.
- `PlaylistDefinition`: `slug`, `title`, `description`, `directory`.

- [ ] Write a failing test asserting the ordered slug/title pairs:
  `electronic/电音`, `japanese-pop/日系流行`, `chinese-pop/华语流行`, `post-rock-punk/后摇&后朋`, `phonk/Phonk`, `math-rock/数摇`, `midwest-emo/中西部emo`, `piano/Piano`.
- [ ] Run `node --test tests/playlists.test.mjs`; expect module-not-found.
- [ ] Run `npm install amplitudejs music-metadata`, implement the exact model, and create the eight directories.
- [ ] Run the category test and `npm run build`; expect success.
- [ ] Commit with message `添加八类歌单目录与数据模型`.

### Task 2: MP3 元数据与封面生成器

**Files:**
- Create: `scripts/build-music-library.mjs`
- Create: `src/generated/music-library.json`
- Create: `public/generated/music-covers/.gitkeep`
- Create: `public/generated/music-covers/default.svg`
- Modify: `package.json`, `.gitignore`
- Test: `tests/music-library.test.mjs`

**Interfaces:**
- JSON shape: `{ generatedAt, playlists: Record<string, Track[]> }`.
- `Track`: `id`, `src`, `cover`, `title`, `artist`, `duration`, `durationLabel`.
- Testable exports: `formatDuration(seconds)`, `fallbackTitle(fileName)`, `scanMusicLibrary(options)`.

- [ ] Write failing tests: `formatDuration(65.9) === "1:05"`, `formatDuration(3601) === "1:00:01"`, `fallbackTitle("01 - 夜空.mp3") === "01 - 夜空"`, and an empty tree returns all eight keys.
- [ ] Run `node --test tests/music-library.test.mjs`; expect missing generator exports.
- [ ] Implement scanning with `parseFile(path, { duration:true })`. Use ID3 title/artist, falling back to filename and “未知艺术家”. Export the first embedded image with MIME-derived extension and SHA-1 filename. Use default SVG when absent.
- [ ] Sort filenames with `localeCompare(..., "zh-CN", { numeric:true })`; URL-encode each path segment; catch per-file errors and warn without stopping.
- [ ] Add scripts: `music:build`, `predev`, `prebuild`, and `test: node --test tests/*.test.mjs`.
- [ ] Run `npm test`, `npm run music:build`, and `npm run build`; expect eight empty arrays and exit 0.
- [ ] Commit with message `自动提取 MP3 元数据和封面`.

### Task 3: 歌单路由与导航

**Files:**
- Modify: `src/components/Sidebar.astro`
- Create: `src/pages/playlists.astro`
- Create: `src/pages/playlists/[slug].astro`
- Create: `src/components/MusicPlayer.astro`
- Test: `tests/playlist-pages.test.mjs`

**Interfaces:**
- `MusicPlayer` props: `{ playlist: PlaylistDefinition; tracks: Track[] }`.
- Root attributes: `data-music-player`, `data-playlist-slug`, `data-track-manifest`.

- [ ] Write a failing build-output test asserting all eight `dist/playlists/<slug>/index.html` files and sidebar labels `04 歌单`, `05 日志`, `06 友链`, `07 关于`.
- [ ] Run the test; expect missing playlist routes.
- [ ] Create the index by reusing `report-head`, `topic-grid`, and `topic-card`.
- [ ] Implement `getStaticPaths()` for eight pages, load matching tracks, and add an accessible “返回歌单” arrow.
- [ ] Insert the sidebar route after topics, use `pathname.startsWith("/playlists")`, and renumber later routes.
- [ ] Run `npm test` and `npm run build`; expect all routes and prior pages.
- [ ] Commit with message `添加歌单索引与播放器路由`.

### Task 4: 自定义播放器界面

**Files:**
- Create: `src/styles/music-player.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/MusicPlayer.astro`
- Test: `tests/player-markup.test.mjs`

**Interfaces:**
- Required selectors: `data-player-title`, `data-mode-button`, `data-prev`, `data-play-pause`, `data-next`, `data-volume`, `data-progress`, `data-progress-fill`, `data-progress-thumb`, `data-track-list`.

- [ ] Write a failing markup test asserting all selectors, range volume input, Chinese accessible labels, and empty text “暂无歌曲，请将 MP3 放入对应目录”.
- [ ] Run it; expect the first missing player control.
- [ ] Build one soft-gray rounded control surface with title, left mode, centered transport, right volume, progress and time labels.
- [ ] Style tokens: surface `rgba(128,128,128,.16)`, played `#c94736`, remaining `rgba(110,110,110,.42)`, white thumb, radius `24px`.
- [ ] Make the progress hit area at least 24px; visible rail grows upward from 4px to 8px on hover/focus. Keep track duration visible and truncate long title/artist.
- [ ] At 760px stack control groups while keeping the red play button visually centered.
- [ ] Run markup tests and build; commit with message `完成自定义歌单播放器界面`.

### Task 5: AmplitudeJS 控制与播放模式

**Files:**
- Create: `src/scripts/playback-state.ts`
- Create: `src/scripts/music-player.ts`
- Modify: `src/components/MusicPlayer.astro`
- Test: `tests/playback-modes.test.mjs`

**Interfaces:**
- Modes: `list | shuffle | sequence | single`.
- Visible mode labels: `列表循环 | 随机 | 顺序播放 | 单曲循环`.
- Pure helpers: `nextMode(mode)`, `nextIndex({ mode,current,length,random })`.

- [ ] Write failing tests for the mode cycle `list → shuffle → sequence → single → list`; list wraps, sequence returns null at the end, single repeats, shuffle uses injected random, and empty lists return null.
- [ ] Run the test; expect missing helpers.
- [ ] Implement the pure helpers, including one-track shuffle.
- [ ] Initialize AmplitudeJS with mapped `name`, `artist`, `url`, `cover_art_url` and saved volume.
- [ ] Wire play/pause, previous, next, volume, track selection, pointer/keyboard seek, active row, title, elapsed/total time, fill/thumb and four-mode button.
- [ ] On song end, use `nextIndex`; on `astro:before-swap`, pause and remove listeners; on `astro:page-load`, initialize once.
- [ ] Persist only volume and mode in `localStorage`; disable playback controls for an empty list.
- [ ] Run `npm test`, `npx astro check`, and `npm run build`; expect zero failures.
- [ ] Commit with message `接入 AmplitudeJS 播放控制`.

### Task 6: 端到端与视觉验证

**Files:**
- Temporary media only; modify production files only for observed defects.

**Interfaces:**
- Verifies MP3 → metadata JSON → Astro route → AmplitudeJS → visible state.

- [ ] Generate a two-second local silent MP3 outside committed source, tagged title `テスト canción été тест`, artist `测试艺术家`, with an embedded cover. Do not download copyrighted media.
- [ ] Copy it temporarily into one category, run music generation, and assert Unicode metadata, cover URL and duration 1–3 seconds.
- [ ] Browser desktop flow: `/playlists/` → category → select → play/pause → seek → volume → four modes → next/previous → back.
- [ ] Verify page identity, nonblank DOM, no framework overlay, console health, screenshot evidence, and sidebar/background stability.
- [ ] Verify a viewport below 760px: no overflow, transport centered, duration visible and progress touchable.
- [ ] Verify paper, black and one image theme; current-page interception, 299px corner, theme borders and presence updates remain correct.
- [ ] Remove temporary MP3/cover, regenerate empty JSON, then run `npm test`, `npx astro check`, `npm run build`, and `git diff --check`.
- [ ] Commit any QA fixes with message `验证歌单播放器完整流程`.
