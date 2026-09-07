import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/MusicPlayer.astro', import.meta.url), 'utf8');

test('renders the complete accessible player control surface', () => {
  for (const selector of [
    'data-player-title', 'data-mode-button', 'data-prev', 'data-play-pause',
    'data-next', 'data-volume', 'data-progress', 'data-progress-fill',
    'data-progress-thumb', 'data-track-list',
  ]) assert.match(source, new RegExp(selector));
  assert.match(source, /type="range"/);
  assert.match(source, /播放|音量|上一首|下一首/);
  assert.match(source, /暂无歌曲，请将 MP3 放入对应目录/);
});
