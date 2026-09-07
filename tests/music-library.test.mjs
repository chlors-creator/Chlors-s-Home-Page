import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  fallbackTitle,
  formatDuration,
  scanMusicLibrary,
} from '../scripts/build-music-library.mjs';

test('formats rounded minute and hour durations for the player', () => {
  assert.equal(formatDuration(65.9), '1:05');
  assert.equal(formatDuration(3601), '1:00:01');
});

test('uses an MP3 filename without its extension as the fallback title', () => {
  assert.equal(fallbackTitle('01 - 夜空.mp3'), '01 - 夜空');
});

test('returns an empty track array for each playlist when the music tree is empty', async () => {
  const musicRoot = await mkdtemp(join(tmpdir(), 'music-library-'));

  try {
    const library = await scanMusicLibrary({ musicRoot });

    assert.deepEqual(Object.keys(library.playlists), [
      'electronic',
      'japanese-pop',
      'vocaloid',
      'chinese-pop',
      'post-rock-punk',
      'phonk',
      'math-rock',
      'midwest-emo',
      'piano',
    ]);
    assert.deepEqual(Object.values(library.playlists), Array(9).fill([]));
  } finally {
    await rm(musicRoot, { recursive: true, force: true });
  }
});
