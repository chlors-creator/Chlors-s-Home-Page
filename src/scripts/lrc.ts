export interface LyricLine {
  time: number;
  text: string;
}

const TIME_TAG = /\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g;
const OFFSET_TAG = /^\s*\[offset:([+-]?\d+)\]\s*$/im;

export function parseLrc(source: string): LyricLine[] {
  const offsetMatch = source.match(OFFSET_TAG);
  const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  const lines: LyricLine[] = [];

  for (const sourceLine of source.split(/\r?\n/)) {
    const timestamps = [...sourceLine.matchAll(TIME_TAG)];
    if (timestamps.length === 0) continue;

    const text = sourceLine.replace(TIME_TAG, '').trim();
    if (!text) continue;

    for (const match of timestamps) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      if (seconds >= 60) continue;

      const fraction = match[3] ?? '';
      const fractionalSeconds = fraction ? Number(fraction) / (10 ** fraction.length) : 0;
      lines.push({
        time: Math.max(0, minutes * 60 + seconds + fractionalSeconds + offsetSeconds),
        text,
      });
    }
  }

  return lines.sort((left, right) => left.time - right.time);
}

export function findActiveLyricIndex(lines: LyricLine[], currentTime: number): number {
  let low = 0;
  let high = lines.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].time <= currentTime) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return activeIndex;
}
