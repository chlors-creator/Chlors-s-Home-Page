import Amplitude from 'amplitudejs';
import { nextIndex, nextMode, type PlaybackMode } from './playback-state';
import { findActiveLyricIndex, parseLrc, type LyricLine } from './lrc';

interface Track { title: string; artist: string; src: string; cover: string; duration: number; lyricsSrc: string | null; }

const MODE_LABELS: Record<PlaybackMode, string> = { list: '列表循环', shuffle: '随机播放', sequence: '顺序播放', single: '单曲循环' };
const cleanups = new WeakMap<HTMLElement, () => void>();

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(total / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : minutes}:${String(total % 60).padStart(2, '0')}`;
}

function readMode(): PlaybackMode { const value = localStorage.getItem('music-playback-mode'); return value === 'shuffle' || value === 'sequence' || value === 'single' ? value : 'list'; }

function initialize(root: HTMLElement): void {
  if (cleanups.has(root)) return;
  const tracks: Track[] = JSON.parse(root.dataset.trackManifest || '[]');
  const playPause = root.querySelector<HTMLButtonElement>('[data-play-pause]');
  const playIcon = playPause?.querySelector<SVGElement>('[data-play-icon]');
  const pauseIcon = playPause?.querySelector<SVGElement>('[data-pause-icon]');
  const modeButton = root.querySelector<HTMLButtonElement>('[data-mode-button]');
  const volume = root.querySelector<HTMLInputElement>('[data-volume]');
  const progress = root.querySelector<HTMLElement>('[data-progress]');
  const fill = root.querySelector<HTMLElement>('[data-progress-fill]');
  const thumb = root.querySelector<HTMLElement>('[data-progress-thumb]');
  const elapsed = root.querySelector<HTMLElement>('[data-elapsed]');
  const duration = root.querySelector<HTMLElement>('[data-duration]');
  const title = root.querySelector<HTMLElement>('[data-player-title]');
  const artist = root.querySelector<HTMLElement>('[data-player-artist]');
  const rows = [...root.querySelectorAll<HTMLElement>('[data-track-index]')];
  const expand = root.querySelector<HTMLButtonElement>('[data-expand-player]'); const lyrics = root.querySelector<HTMLElement>('[data-lyrics]'); const lyricLines = root.querySelector<HTMLOListElement>('[data-lyrics-lines]'); const emptyLyrics = root.querySelector<HTMLElement>('[data-lyrics-empty]');
  const lyricCache = new Map<string, LyricLine[]>(); let currentLyrics: LyricLine[] = []; let activeLyric = -1;
  const renderLyrics = () => { if (!lyricLines || !emptyLyrics) return; emptyLyrics.hidden = currentLyrics.length > 0; lyricLines.innerHTML = ''; currentLyrics.forEach((line, index) => { const item = document.createElement('li'); item.textContent = line.text; item.toggleAttribute('data-active', index === activeLyric); lyricLines.append(item); }); };
  const loadLyrics = async () => { currentLyrics = []; activeLyric = -1; const src = tracks[current]?.lyricsSrc; if (src) { try { const cached = lyricCache.get(src); const text = cached ? null : await fetch(src).then((r) => r.ok ? r.text() : Promise.reject(new Error('lyrics'))); currentLyrics = cached || parseLrc(text || ''); if (!cached) lyricCache.set(src, currentLyrics); } catch {} } renderLyrics(); };
  let mode = readMode();
  let current = 0;
  let ended = false;
  let disposed = false;
  let playerAnimation: Animation | null = null;
  let componentAnimations: Animation[] = [];
  const savedVolume = localStorage.getItem('music-volume');
  const parsedVolume = savedVolume === null ? 0.8 : Number(savedVolume);
  const initialVolume = Number.isFinite(parsedVolume) ? Math.min(1, Math.max(0, parsedVolume)) : 0.8;
  const renderMode = () => {
    if (!modeButton) return;
    modeButton.querySelectorAll<SVGElement>('[data-mode-icon]').forEach((icon) => {
      icon.toggleAttribute('hidden', icon.dataset.modeIcon !== mode);
    });
    modeButton.setAttribute('aria-label', `播放模式：${MODE_LABELS[mode]}`);
    modeButton.title = MODE_LABELS[mode];
  };
  renderMode();
  if (volume) volume.value = String(initialVolume);
  if (!tracks.length) {
    root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach((control) => { control.disabled = true; });
    return;
  }
  Amplitude.init({
    songs: tracks.map((track) => ({ name: track.title, artist: track.artist, url: track.src, cover_art_url: track.cover })),
    volume: initialVolume * 100,
    continue_next: false,
    callbacks: {
      // Amplitude stops asynchronously after 'ended'; advance only once that stop finishes.
      stop: () => {
        if (disposed || !ended) return;
        ended = false;
        const next = nextIndex({ mode, current, length: tracks.length });
        if (next !== null) play(next);
        else render();
      },
    },
  });
  const audio = Amplitude.getAudio();
  const totalDuration = () => Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : tracks[current].duration || 0;
  const render = () => {
    const played = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const total = totalDuration();
    const isPlaying = !audio.paused && !audio.ended && !audio.error;
    if (playPause) {
      playIcon?.toggleAttribute('hidden', isPlaying);
      pauseIcon?.toggleAttribute('hidden', !isPlaying);
      playPause.setAttribute('aria-label', isPlaying ? '暂停' : '播放');
      playPause.title = isPlaying ? '暂停' : '播放';
    }
    if (title) title.textContent = tracks[current].title;
    if (artist) artist.textContent = tracks[current].artist;
    if (elapsed) elapsed.textContent = formatTime(played);
    if (duration) duration.textContent = formatTime(total);
    const percent = total ? Math.min(100, Math.max(0, played / total * 100)) : 0;
    if (fill) fill.style.width = `${percent}%`;
    if (thumb) thumb.style.left = `${percent}%`;
    if (progress) {
      progress.setAttribute('aria-valuemax', String(total));
      progress.setAttribute('aria-valuenow', String(played));
    }
    rows.forEach((row) => row.toggleAttribute('data-active', Number(row.dataset.trackIndex) === current));
    if (currentLyrics.length) { const nextLyric = findActiveLyricIndex(currentLyrics, played); if (nextLyric !== activeLyric) { activeLyric = nextLyric; renderLyrics(); lyricLines?.querySelector('[data-active]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  };
  const play = (index: number) => {
    ended = false;
    current = index;
    Amplitude.playSongAtIndex(index);
    loadLyrics();
    render();
  };
  const onPlayPause = () => {
    if (audio.paused || audio.ended) Amplitude.play();
    else Amplitude.pause();
    render();
  };
  const onMode = () => {
    mode = nextMode(mode);
    localStorage.setItem('music-playback-mode', mode);
    renderMode();
  };
  const onVolume = () => {
    const value = Number(volume?.value || 0);
    Amplitude.setVolume(value * 100);
    localStorage.setItem('music-volume', String(value));
  };
  const onProgress = (event: Event) => {
    const rect = progress?.getBoundingClientRect();
    const total = totalDuration();
    if (!rect || !total) return;
    let ratio: number;
    if (event instanceof KeyboardEvent) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      ratio = audio.currentTime / total + (event.key === 'ArrowRight' ? 0.05 : -0.05);
    } else {
      ratio = ((event as MouseEvent).clientX - rect.left) / rect.width;
    }
    Amplitude.setSongPlayedPercentage(Math.min(1, Math.max(0, ratio)) * 100);
    render();
  };
  const onEnded = () => { ended = true; render(); };
  const listeners: Array<[EventTarget | null, string, EventListener]> = [
    [playPause, 'click', onPlayPause], [modeButton, 'click', onMode],
    [volume, 'input', onVolume], [progress, 'click', onProgress], [progress, 'keydown', onProgress],
    [root.querySelector('[data-prev]'), 'click', () => play((current - 1 + tracks.length) % tracks.length)],
    [root.querySelector('[data-next]'), 'click', () => {
      const next = nextIndex({ mode, current, length: tracks.length });
      if (next !== null) play(next);
    }],
    [audio, 'ended', onEnded],
  ];
  const setExpandLabel = (expanded: boolean) => { expand?.setAttribute('aria-expanded', String(expanded)); expand?.setAttribute('aria-label', expanded ? '收起播放器' : '展开播放器'); if (expand) expand.title = expanded ? '收起播放器' : '展开播放器'; };
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animatedParts = () => [...root.querySelectorAll<HTMLElement>('[data-expand-player],.player-heading,.player-controls,.progress-control,.lyrics-panel')];
  const partRects = () => new Map(animatedParts().filter((part) => !part.hidden).map((part) => [part, part.getBoundingClientRect()]));
  const stopAnimations = () => { playerAnimation?.cancel(); componentAnimations.forEach((animation) => animation.cancel()); componentAnimations = []; };
  const animateParts = (from: Map<HTMLElement, DOMRect>, to: Map<HTMLElement, DOMRect>, reverse = false) => {
    componentAnimations = animatedParts().map((part, index) => {
      const first = from.get(part); const last = to.get(part);
      const deltaX = first && last ? first.left - last.left : 0; const deltaY = first && last ? first.top - last.top : 18;
      const startFrame = { transform: `translate(${deltaX}px,${deltaY}px)`, opacity: first ? .72 : 0 };
      const endFrame = { transform: 'translate(0,0)', opacity: 1 };
      return part.animate(reverse ? [endFrame, startFrame] : [startFrame, endFrame], { duration: 320, delay: index * 24, easing: 'cubic-bezier(.22,.8,.24,1)', fill: reverse ? 'forwards' : 'backwards' });
    });
  };
  const toggleExpanded = async () => {
    const expanded = root.dataset.expanded !== 'true';
    const start = root.getBoundingClientRect();
    stopAnimations();
    if (expanded) {
      const beforeParts = partRects();
      root.dataset.expanded = 'true'; document.documentElement.classList.add('player-expanded'); if (lyrics) lyrics.hidden = false;
      const end = root.getBoundingClientRect();
      const afterParts = partRects();
      const inset = `${Math.max(0, start.top - end.top)}px ${Math.max(0, end.right - start.right)}px ${Math.max(0, end.bottom - start.bottom)}px ${Math.max(0, start.left - end.left)}px`;
      if (!prefersReducedMotion()) { playerAnimation = root.animate([{ clipPath: `inset(${inset} round 24px)`, opacity: .82 }, { clipPath: 'inset(0 round var(--radius) 0 0 0)', opacity: 1 }], { duration: 440, easing: 'cubic-bezier(.22,.8,.24,1)' }); animateParts(beforeParts, afterParts); }
    } else {
      const beforeParts = partRects(); const end = root.getBoundingClientRect(); root.dataset.expanded = 'false'; document.documentElement.classList.remove('player-expanded'); const target = root.getBoundingClientRect(); const afterParts = partRects(); root.dataset.expanded = 'true'; document.documentElement.classList.add('player-expanded');
      const inset = `${Math.max(0, target.top - end.top)}px ${Math.max(0, end.right - target.right)}px ${Math.max(0, end.bottom - target.bottom)}px ${Math.max(0, target.left - end.left)}px`;
      if (!prefersReducedMotion()) { playerAnimation = root.animate([{ clipPath: 'inset(0 round var(--radius) 0 0 0)', opacity: 1 }, { clipPath: `inset(${inset} round 24px)`, opacity: .82 }], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }); animateParts(afterParts, beforeParts, true); await Promise.all([playerAnimation.finished, ...componentAnimations.map((animation) => animation.finished)].map((finished) => finished.catch(() => {}))); }
      root.dataset.expanded = 'false'; document.documentElement.classList.remove('player-expanded'); if (lyrics) lyrics.hidden = true;
      stopAnimations();
    }
    setExpandLabel(expanded);
  };
  const onDocumentKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && root.dataset.expanded === 'true') void toggleExpanded(); };
  expand?.addEventListener('click', toggleExpanded); document.addEventListener('keydown', onDocumentKeydown);
  loadLyrics();
  for (const event of ['play', 'playing', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'seeked', 'error']) {
    listeners.push([audio, event, render]);
  }
  rows.forEach((row) => listeners.push([row.querySelector('button'), 'click', () => play(Number(row.dataset.trackIndex))]));
  listeners.forEach(([element, event, handler]) => element?.addEventListener(event, handler));
  render();
  cleanups.set(root, () => {
    disposed = true;
    ended = false;
    listeners.forEach(([element, event, handler]) => element?.removeEventListener(event, handler));
    expand?.removeEventListener('click', toggleExpanded);
    document.removeEventListener('keydown', onDocumentKeydown);
    stopAnimations();
    document.documentElement.classList.remove('player-expanded');
    Amplitude.pause();
    cleanups.delete(root);
  });
}

function initializeAll() { document.querySelectorAll<HTMLElement>('[data-music-player]').forEach(initialize); }
document.addEventListener('astro:page-load', initializeAll);
document.addEventListener('astro:before-swap', () => document.querySelectorAll<HTMLElement>('[data-music-player]').forEach((root) => cleanups.get(root)?.()));
initializeAll();
