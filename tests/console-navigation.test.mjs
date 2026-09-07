import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const consolePage = await readFile(new URL('../src/pages/console.astro', import.meta.url), 'utf8');
const consoleScript = await readFile(new URL('../src/scripts/console.ts', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/components/Sidebar.astro', import.meta.url), 'utf8');
const publishApi = await readFile(new URL('../functions/api/publish.ts', import.meta.url), 'utf8');
const musicUploadApi = await readFile(new URL('../functions/api/upload-music.ts', import.meta.url), 'utf8');

test('console login form cannot fall back to a credential-bearing GET URL', () => {
  assert.match(consolePage, /<form[^>]*method="post"[^>]*data-login-form/);
  assert.match(consoleScript, /history\.replaceState/);
});

test('console initialization survives Astro client-side navigation', () => {
  assert.match(consoleScript, /astro:page-load/);
});

test('sidebar exposes the console route', () => {
  assert.match(sidebar, /href="\/console\/"/);
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
