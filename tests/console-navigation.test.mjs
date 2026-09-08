import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const consolePage = await readFile(new URL('../src/pages/console.astro', import.meta.url), 'utf8');
const loginPage = await readFile(new URL('../src/pages/console/login.astro', import.meta.url), 'utf8');
const consoleScript = await readFile(new URL('../src/scripts/console.ts', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/components/Sidebar.astro', import.meta.url), 'utf8');
const publishApi = await readFile(new URL('../functions/api/publish.ts', import.meta.url), 'utf8');
const musicUploadApi = await readFile(new URL('../functions/api/upload-music.ts', import.meta.url), 'utf8');
const authApi = await readFile(new URL('../functions/api/auth.ts', import.meta.url), 'utf8');
const contentStyles = await readFile(new URL('../src/styles/content.css', import.meta.url), 'utf8');
const consoleCardStyles = await readFile(new URL('../src/styles/console-cards.css', import.meta.url), 'utf8');

test('console login form cannot fall back to a credential-bearing GET URL', () => {
  assert.match(loginPage, /<form[^>]*method="post"[^>]*data-login-form/);
  assert.match(consoleScript, /history\.replaceState/);
});

test('console initialization survives Astro client-side navigation', () => {
  assert.match(consoleScript, /astro:page-load/);
});

test('console login submission stays inside the JSON request flow', () => {
  assert.match(consoleScript, /login\) login\.addEventListener\('submit'/);
  assert.match(consoleScript, /event\.preventDefault\(\)/);
});

test('a late initial auth probe cannot overwrite a newer login result', () => {
  assert.match(consoleScript, /authRequestVersion/);
  assert.match(consoleScript, /const requestVersion = \+\+authRequestVersion/);
  assert.match(consoleScript, /requestVersion !== authRequestVersion/);
});

test('auth cookies only use Secure when the request is HTTPS', () => {
  assert.match(authApi, /new URL\(request\.url\)/);
  assert.match(authApi, /Secure/);
  assert.match(authApi, /protocol === ['"]https:/);
});

test('auth session decoding computes Base64 padding from the payload length', () => {
  assert.match(authApi, /const padding = \(4 - \(payload\.length % 4\)\) % 4/);
  assert.match(authApi, /'='.repeat\(padding\)/);
  assert.doesNotMatch(authApi, /replaceAll\('_', '\/'\) \+ '=='/);
});

test('sidebar exposes the console route', () => {
  assert.match(sidebar, /href="\/console\/"/);
});

test('console cards use the requested concise descriptions', () => {
  assert.match(consolePage, /<h2>登录<\/h2><p>登录到控制台<\/p>/);
  assert.match(consolePage, /<h2>上传文章<\/h2><p>上传Markdown文档<\/p>/);
  assert.match(consolePage, /<h2>上传音乐<\/h2><p>上传MP3音频文件<\/p>/);
  assert.match(consolePage, /<h2>上传歌词<\/h2><p>上传LRC歌词文件<\/p>/);
});

test('all console cards share the GitHub-style hover icon animation', () => {
  assert.match(consolePage, /login-console-card/);
  assert.match(consolePage, /article-upload-card/);
  assert.match(consolePage, /music-upload-card/);
  assert.match(consolePage, /lyrics-upload-card/);
  assert.match(consoleCardStyles, /\.topic-card\.console-icon-card:hover/);
  assert.match(consoleCardStyles, /console-login-icon\.png/);
  assert.match(consoleCardStyles, /console-article-icon\.png/);
  assert.match(consoleCardStyles, /music-upload-icon\.png/);
  assert.match(consoleCardStyles, /console-lyrics-icon\.png/);
  assert.match(consoleCardStyles, /translate\(12px, 12px\) scale\(\.86\)/);
});

test('article publishing does not ask for a topic slug', () => {
  assert.doesNotMatch(consolePage, /name="topicSlug"/);
  assert.doesNotMatch(consolePage, />专题 slug</);
});

test('article publishing derives the topic slug on the server', () => {
  assert.doesNotMatch(publishApi, /!input\.topicSlug/);
  assert.match(publishApi, /const topicSlug =/);
  assert.match(publishApi, /TOPIC_SLUGS\[topic\]/);
  assert.match(publishApi, /topicSlug: \$\{quote\(topicSlug\)\}/);
});

test('music upload accepts every playlist exposed by the console', () => {
  assert.match(musicUploadApi, /'vocaloid'/);
});

test('file conflict dialog fills the content area with a frosted overlay', () => {
  assert.match(contentStyles, /dialog\[data-file-conflict\].*position:fixed/);
  assert.match(contentStyles, /inset:0 0 0 299px/);
  assert.match(contentStyles, /backdrop-filter:blur\(26px\)/);
  assert.match(contentStyles, /conflict-files::before/);
});

test('file conflict actions provide symmetric overwrite and keep hover transforms', () => {
  assert.match(contentStyles, /data-overwrite\]:hover[^}]*rotateY\(17deg\)/);
  assert.match(contentStyles, /data-keep-existing\]:hover[^}]*rotateY\(-17deg\)/);
  assert.match(contentStyles, /background:#c94736/);
  assert.match(contentStyles, /background:#3d9b68/);
});

test('console home exposes four action cards and dedicated upload routes', () => {
  assert.match(consolePage, /data-console-card="login"/);
  assert.match(consolePage, /data-console-card="article"/);
  assert.match(consolePage, /data-console-card="music"/);
  assert.match(consolePage, /data-console-card="lyrics"/);
  assert.match(consolePage, /href="\/console\/login\//);
  assert.match(consolePage, /href="\/console\/article\//);
  assert.match(consolePage, /href="\/console\/music\//);
  assert.match(consolePage, /href="\/console\/lyrics\//);
});

test('console script gates upload cards and supports top login notices', () => {
  assert.match(consoleScript, /未登录/);
  assert.match(consoleScript, /已登录/);
  assert.match(consoleScript, /data-console-card/);
  assert.match(consoleScript, /location\.replace/);
});

test('article upload endpoint reports file conflicts before replacing a post', () => {
  assert.match(publishApi, /file_exists/);
  assert.match(publishApi, /incoming/);
  assert.match(publishApi, /existing/);
});
