import Amplitude from 'amplitudejs';
import { nextIndex, nextMode, type PlaybackMode } from './playback-state';
import { findActiveLyricIndex, parseLrc, type LyricLine } from './lrc';

interface Track { title: string; artist: string; src: string; cover: string; duration: number; lyricsSrc: string | null; }
interface Queue { slug: string; title: string; tracks: Track[]; }
interface PlayerController {
  queue: Queue | null; current: number; mode: PlaybackMode; audio: HTMLAudioElement | null;
  subscribe(listener: () => void): () => void; notify(): void;
  playQueue(queue: Queue, index: number): void; toggle(fallback?: Queue): void;
  previous(): void; next(adjacent?: boolean): void; cycleMode(): void; setVolume(value: number): void; seek(ratio: number): void;
}

declare global { interface Window { __chlorsMusicPlayer?: PlayerController; } }

const MODE_LABELS: Record<PlaybackMode, string> = { list: '列表循环', shuffle: '随机播放', sequence: '顺序播放', single: '单曲循环' };
const cleanups = new WeakMap<HTMLElement, () => void>();

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(total / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : minutes}:${String(total % 60).padStart(2, '0')}`;
}

function readMode(): PlaybackMode {
  const value = localStorage.getItem('music-playback-mode');
  return value === 'shuffle' || value === 'sequence' || value === 'single' ? value : 'list';
}

function createController(): PlayerController {
  const listeners = new Set<() => void>();
  let ended = false;
  const controller: PlayerController = {
    queue: null, current: 0, mode: readMode(), audio: null,
    subscribe(listener) { listeners.add(listener); listener(); return () => listeners.delete(listener); },
    notify() { listeners.forEach((listener) => listener()); },
    playQueue(queue, index) {
      const queueChanged = controller.queue?.slug !== queue.slug;
      controller.queue = queue;
      controller.current = Math.min(Math.max(index, 0), Math.max(0, queue.tracks.length - 1));
      ended = false;
      if (queueChanged || !controller.audio) {
        const savedVolume = Number(localStorage.getItem('music-volume') ?? 0.8);
        Amplitude.init({
          songs: queue.tracks.map((track) => ({ name: track.title, artist: track.artist, url: track.src, cover_art_url: track.cover })),
          volume: Math.min(1, Math.max(0, Number.isFinite(savedVolume) ? savedVolume : 0.8)) * 100,
          continue_next: false,
          callbacks: {
            stop: () => {
              if (!ended) return;
              ended = false;
              const next = nextIndex({ mode: controller.mode, current: controller.current, length: controller.queue?.tracks.length || 0 });
              if (next !== null && controller.queue) controller.playQueue(controller.queue, next);
              controller.notify();
            },
          },
        });
        controller.audio = Amplitude.getAudio();
        for (const event of ['play', 'playing', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'seeked', 'error']) {
          controller.audio.addEventListener(event, controller.notify);
        }
        controller.audio.addEventListener('ended', () => { ended = true; controller.notify(); });
      }
      Amplitude.playSongAtIndex(controller.current);
      controller.notify();
    },
    toggle(fallback) {
      if (!controller.queue && fallback?.tracks.length) { controller.playQueue(fallback, 0); return; }
      if (!controller.audio) return;
      if (controller.audio.paused || controller.audio.ended) Amplitude.play(); else Amplitude.pause();
      controller.notify();
    },
    previous() {
      if (controller.queue?.tracks.length) controller.playQueue(controller.queue, (controller.current - 1 + controller.queue.tracks.length) % controller.queue.tracks.length);
    },
    next(adjacent = false) {
      if (!controller.queue?.tracks.length) return;
      const next = adjacent
        ? (controller.current + 1) % controller.queue.tracks.length
        : nextIndex({ mode: controller.mode, current: controller.current, length: controller.queue.tracks.length });
      if (next !== null) controller.playQueue(controller.queue, next);
    },
    cycleMode() {
      controller.mode = nextMode(controller.mode);
      localStorage.setItem('music-playback-mode', controller.mode);
      controller.notify();
    },
    setVolume(value) {
      Amplitude.setVolume(value * 100);
      localStorage.setItem('music-volume', String(value));
      controller.notify();
    },
    seek(ratio) {
      if (controller.audio) Amplitude.setSongPlayedPercentage(Math.min(1, Math.max(0, ratio)) * 100);
    },
  };
  return controller;
}

function initialize(root: HTMLElement): void {
  if (cleanups.has(root)) return;
  const controller = window.__chlorsMusicPlayer ||= createController();
  const localTracks: Track[] = JSON.parse(root.dataset.trackManifest || '[]');
  const localQueue: Queue | undefined = localTracks.length ? {
    slug: root.dataset.playlistSlug || '',
    title: root.getAttribute('aria-label')?.replace(/播放器$/, '') || '',
    tracks: localTracks,
  } : undefined;
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const playPause = query<HTMLButtonElement>('[data-play-pause]');
  const playIcon = playPause?.querySelector<SVGElement>('[data-play-icon]');
  const pauseIcon = playPause?.querySelector<SVGElement>('[data-pause-icon]');
  const modeButton = query<HTMLButtonElement>('[data-mode-button]');
  const volume = query<HTMLInputElement>('[data-volume]');
  const progress = query<HTMLElement>('[data-progress]');
  const fill = query<HTMLElement>('[data-progress-fill]');
  const thumb = query<HTMLElement>('[data-progress-thumb]');
  const elapsed = query<HTMLElement>('[data-elapsed]');
  const duration = query<HTMLElement>('[data-duration]');
  const title = query<HTMLElement>('[data-player-title]');
  const artist = query<HTMLElement>('[data-player-artist]');
  const rows = [...root.querySelectorAll<HTMLElement>('[data-track-index]')];
  const expand = query<HTMLButtonElement>('[data-expand-player]');
  const lyrics = query<HTMLElement>('[data-lyrics]');
  const lyricLines = query<HTMLOListElement>('[data-lyrics-lines]');
  const emptyLyrics = query<HTMLElement>('[data-lyrics-empty]');
  const lyricCache = new Map<string, LyricLine[]>();
  let currentLyrics: LyricLine[] = [];
  let activeLyric = -1;
  let loadedLyricsSrc: string | null | undefined;
  let lyricRequest = 0;
  let playerAnimation: Animation | null = null;
  let componentAnimations: Animation[] = [];

  const renderLyrics = () => {
    if (!lyricLines || !emptyLyrics) return;
    emptyLyrics.hidden = currentLyrics.length > 0;
    lyricLines.innerHTML = '';
    currentLyrics.forEach((line, index) => {
      const item = document.createElement('li');
      item.textContent = line.text;
      item.toggleAttribute('data-active', index === activeLyric);
      lyricLines.append(item);
    });
  };
  const loadLyrics = async (src: string | null | undefined) => {
    if (src === loadedLyricsSrc) return;
    loadedLyricsSrc = src;
    currentLyrics = [];
    activeLyric = -1;
    const request = ++lyricRequest;
    if (src) {
      try {
        const cached = lyricCache.get(src);
        const text = cached ? null : await fetch(src).then((response) => response.ok ? response.text() : Promise.reject(new Error('lyrics')));
        if (request !== lyricRequest) return;
        currentLyrics = cached || parseLrc(text || '');
        if (!cached) lyricCache.set(src, currentLyrics);
      } catch { /* Missing lyrics use the instrumental fallback. */ }
    }
    renderLyrics();
  };
  const render = () => {
    const track = controller.queue?.tracks[controller.current];
    const audio = controller.audio;
    const played = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const total = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : track?.duration || 0;
    const isPlaying = Boolean(audio && !audio.paused && !audio.ended && !audio.error);
    playIcon?.toggleAttribute('hidden', isPlaying);
    pauseIcon?.toggleAttribute('hidden', !isPlaying);
    if (playPause) {
      playPause.disabled = !track && !localQueue;
      playPause.setAttribute('aria-label', isPlaying ? '暂停' : '播放');
      playPause.title = isPlaying ? '暂停' : '播放';
    }
    if (title) title.textContent = track?.title || localTracks[0]?.title || '暂无正在播放';
    if (artist) artist.textContent = track?.artist || localTracks[0]?.artist || '—';
    if (elapsed) elapsed.textContent = formatTime(played);
    if (duration) duration.textContent = formatTime(total);
    const percent = total ? Math.min(100, Math.max(0, played / total * 100)) : 0;
    if (fill) fill.style.width = `${percent}%`;
    if (thumb) thumb.style.left = `${percent}%`;
    if (progress) {
      progress.setAttribute('aria-valuemax', String(total));
      progress.setAttribute('aria-valuenow', String(played));
    }
    if (volume) volume.value = String(Number(localStorage.getItem('music-volume') ?? 0.8));
    if (modeButton) {
      modeButton.querySelectorAll<SVGElement>('[data-mode-icon]').forEach((icon) => icon.toggleAttribute('hidden', icon.dataset.modeIcon !== controller.mode));
      modeButton.setAttribute('aria-label', `播放模式：${MODE_LABELS[controller.mode]}`);
      modeButton.title = MODE_LABELS[controller.mode];
      modeButton.disabled = !track && !localQueue;
    }
    root.querySelectorAll<HTMLButtonElement>('[data-prev], [data-next]').forEach((button) => { button.disabled = !track; });
    if (volume) volume.disabled = !track && !localQueue;
    rows.forEach((row) => row.toggleAttribute('data-active', controller.queue?.slug === localQueue?.slug && Number(row.dataset.trackIndex) === controller.current));
    void loadLyrics(track?.lyricsSrc);
    if (currentLyrics.length) {
      const nextLyric = findActiveLyricIndex(currentLyrics, played);
      if (nextLyric !== activeLyric) {
        activeLyric = nextLyric;
        renderLyrics();
        lyricLines?.querySelector('[data-active]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  };
  const onProgress = (event: Event) => {
    const rect = progress?.getBoundingClientRect();
    const audio = controller.audio;
    const total = audio?.duration || 0;
    if (!rect || !audio || !total) return;
    let ratio: number;
    if (event instanceof KeyboardEvent) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      ratio = audio.currentTime / total + (event.key === 'ArrowRight' ? 0.05 : -0.05);
    } else ratio = ((event as MouseEvent).clientX - rect.left) / rect.width;
    controller.seek(ratio);
    render();
  };
  const listeners: Array<[EventTarget | null, string, EventListener]> = [
    [playPause, 'click', () => controller.toggle(localQueue)],
    [modeButton, 'click', () => controller.cycleMode()],
    [volume, 'input', () => controller.setVolume(Number(volume?.value || 0))],
    [progress, 'click', onProgress], [progress, 'keydown', onProgress],
    [query('[data-prev]'), 'click', () => controller.previous()],
    [query('[data-next]'), 'click', () => controller.next(root.dataset.homePlayer === 'true')],
  ];
  rows.forEach((row) => listeners.push([row.querySelector('button'), 'click', () => localQueue && controller.playQueue(localQueue, Number(row.dataset.trackIndex))]));
  listeners.forEach(([element, event, handler]) => element?.addEventListener(event, handler));
  const unsubscribe = controller.subscribe(render);

  const setExpandLabel = (expanded: boolean) => {
    expand?.setAttribute('aria-expanded', String(expanded));
    expand?.setAttribute('aria-label', expanded ? '收起播放器' : '展开播放器');
    if (expand) expand.title = expanded ? '收起播放器' : '展开播放器';
  };
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
      const end = root.getBoundingClientRect(); const afterParts = partRects();
      const inset = `${Math.max(0, start.top - end.top)}px ${Math.max(0, end.right - start.right)}px ${Math.max(0, end.bottom - start.bottom)}px ${Math.max(0, start.left - end.left)}px`;
      if (!prefersReducedMotion()) {
        playerAnimation = root.animate([{ clipPath: `inset(${inset} round 24px)`, opacity: .82 }, { clipPath: 'inset(0 round var(--radius) 0 0 0)', opacity: 1 }], { duration: 440, easing: 'cubic-bezier(.22,.8,.24,1)' });
        animateParts(beforeParts, afterParts);
      }
    } else {
      const beforeParts = partRects(); const end = root.getBoundingClientRect();
      root.dataset.expanded = 'false'; document.documentElement.classList.remove('player-expanded');
      const target = root.getBoundingClientRect(); const afterParts = partRects();
      root.dataset.expanded = 'true'; document.documentElement.classList.add('player-expanded');
      const inset = `${Math.max(0, target.top - end.top)}px ${Math.max(0, end.right - target.right)}px ${Math.max(0, end.bottom - target.bottom)}px ${Math.max(0, target.left - end.left)}px`;
      if (!prefersReducedMotion()) {
        playerAnimation = root.animate([{ clipPath: 'inset(0 round var(--radius) 0 0 0)', opacity: 1 }, { clipPath: `inset(${inset} round 24px)`, opacity: .82 }], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
        animateParts(afterParts, beforeParts, true);
        await Promise.all([playerAnimation.finished, ...componentAnimations.map((animation) => animation.finished)].map((finished) => finished.catch(() => {})));
      }
      root.dataset.expanded = 'false'; document.documentElement.classList.remove('player-expanded'); if (lyrics) lyrics.hidden = true; stopAnimations();
    }
    setExpandLabel(expanded);
  };
  const onDocumentKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && root.dataset.expanded === 'true') void toggleExpanded(); };
  expand?.addEventListener('click', toggleExpanded);
  document.addEventListener('keydown', onDocumentKeydown);
  cleanups.set(root, () => {
    unsubscribe();
    listeners.forEach(([element, event, handler]) => element?.removeEventListener(event, handler));
    expand?.removeEventListener('click', toggleExpanded);
    document.removeEventListener('keydown', onDocumentKeydown);
    stopAnimations();
    document.documentElement.classList.remove('player-expanded');
    cleanups.delete(root);
  });
}

function initializeAll() { document.querySelectorAll<HTMLElement>('[data-music-player]').forEach(initialize); }
document.addEventListener('astro:page-load', initializeAll);
document.addEventListener('astro:before-swap', () => document.querySelectorAll<HTMLElement>('[data-music-player]').forEach((root) => cleanups.get(root)?.()));
initializeAll();
