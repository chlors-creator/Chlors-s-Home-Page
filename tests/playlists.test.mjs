import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configSource = await readFile(new URL('../src/data/playlists.json', import.meta.url), 'utf8');
const adapterSource = await readFile(new URL('../src/data/playlists.ts', import.meta.url), 'utf8');
const PLAYLISTS = JSON.parse(configSource);
const getPlaylist = (slug) => PLAYLISTS.find((playlist) => playlist.slug === slug);

test('exposes the nine playlist categories in display order', () => {
  assert.deepEqual(
    PLAYLISTS.map(({ slug, title }) => [slug, title]),
    [
      ['electronic', '电音'],
      ['japanese-pop', '日系流行'],
      ['vocaloid', 'Vocaloid'],
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

test('uses the shared JSON config from the TypeScript adapter', () => {
  assert.match(adapterSource, /from ['"]\.\/playlists\.json['"]/);
  assert.deepEqual(
    PLAYLISTS.find((playlist) => playlist.slug === 'post-rock-punk')?.children.map(({ slug }) => slug),
    ['post-rock', 'russian-post-punk', 'english-post-punk', 'chinese-post-punk'],
  );
});
