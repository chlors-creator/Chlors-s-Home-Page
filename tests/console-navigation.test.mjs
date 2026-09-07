import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const consolePage = await readFile(new URL('../src/pages/console.astro', import.meta.url), 'utf8');
const consoleScript = await readFile(new URL('../src/scripts/console.ts', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/components/Sidebar.astro', import.meta.url), 'utf8');

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
