import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/data/playlists.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { PLAYLISTS, getPlaylist } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`,
);

test('exposes the eight playlist categories in display order', () => {
  assert.deepEqual(
    PLAYLISTS.map(({ slug, title }) => [slug, title]),
    [
      ['electronic', '电音'],
      ['japanese-pop', '日系流行'],
      ['chinese-pop', '华语流行'],
      ['post-rock-punk', '后摇&后朋'],
      ['phonk', 'Phonk'],
      ['math-rock', '数摇'],
      ['midwest-emo', '中西部emo'],
      ['piano', 'Piano'],
    ],
  );
});

test('finds a playlist by slug and returns undefined for an unknown slug', () => {
  assert.equal(getPlaylist('piano')?.directory, 'piano');
  assert.equal(getPlaylist('unknown'), undefined);
});
