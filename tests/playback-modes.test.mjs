import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/scripts/playback-state.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { nextMode, nextIndex } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('cycles through the four visible playback modes', () => {
  assert.equal(nextMode('list'), 'shuffle');
  assert.equal(nextMode('shuffle'), 'sequence');
  assert.equal(nextMode('sequence'), 'single');
  assert.equal(nextMode('single'), 'list');
});

test('chooses the next track according to each playback mode', () => {
  assert.equal(nextIndex({ mode: 'list', current: 2, length: 3 }), 0);
  assert.equal(nextIndex({ mode: 'sequence', current: 2, length: 3 }), null);
  assert.equal(nextIndex({ mode: 'single', current: 1, length: 3 }), 1);
  assert.equal(nextIndex({ mode: 'shuffle', current: 0, length: 3, random: () => 0.8 }), 2);
  assert.equal(nextIndex({ mode: 'shuffle', current: 0, length: 1, random: () => 0 }), 0);
  assert.equal(nextIndex({ mode: 'list', current: 0, length: 0 }), null);
});
