export type PlaybackMode = 'list' | 'shuffle' | 'sequence' | 'single';

const MODES: PlaybackMode[] = ['list', 'shuffle', 'sequence', 'single'];

export function nextMode(mode: PlaybackMode): PlaybackMode {
  return MODES[(MODES.indexOf(mode) + 1 + MODES.length) % MODES.length];
}

export function nextIndex({ mode, current, length, random = Math.random }: { mode: PlaybackMode; current: number; length: number; random?: () => number }): number | null {
  if (length <= 0) return null;
  if (mode === 'single') return current;
  if (mode === 'sequence') return current + 1 < length ? current + 1 : null;
  if (mode === 'shuffle') { if (length === 1) return 0; const candidate = Math.floor(random() * (length - 1)); return candidate >= current ? candidate + 1 : candidate; }
  return (current + 1) % length;
}
