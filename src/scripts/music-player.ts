import Amplitude from 'amplitudejs';
import { nextIndex, nextMode, type PlaybackMode } from './playback-state';

const MODE_LABELS: Record<PlaybackMode, string> = { list: '列表循环', shuffle: '随机', sequence: '顺序播放', single: '单曲循环' };
const instances = new WeakSet<HTMLElement>();
const cleanups = new WeakMap<HTMLElement, () => void>();

function formatTime(seconds: number): string { if (!Number.isFinite(seconds) || seconds < 0) return '0:00'; const total = Math.floor(seconds); const mins = Math.floor(total / 60); return `${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}:` : ''}${String(mins % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`.replace(/^0:/, ''); }

function readMode(): PlaybackMode { const value = localStorage.getItem('music-playback-mode'); return value === 'shuffle' || value === 'sequence' || value === 'single' ? value : 'list'; }

function initialize(root: HTMLElement): () => void {
  if (instances.has(root)) return () => {};
  instances.add(root);
  const tracks = JSON.parse(root.dataset.trackManifest || '[]');
  const playPause = root.querySelector<HTMLButtonElement>('[data-play-pause]');
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
  let mode = readMode();
  let current = 0;
  const savedVolume = Number(localStorage.getItem('music-volume'));
  const initialVolume = Number.isFinite(savedVolume) ? savedVolume : 0.8;
  if (!tracks.length) { root.querySelectorAll('button, input').forEach((control) => { (control as HTMLButtonElement).disabled = true; }); return () => {}; }
  Amplitude.init({ songs: tracks.map((track: any) => ({ name: track.title, artist: track.artist, url: track.src, cover_art_url: track.cover })), volume: initialVolume });
  if (volume) volume.value = String(initialVolume);
  const renderMode = () => { if (modeButton) { modeButton.textContent = MODE_LABELS[mode]; modeButton.setAttribute('aria-label', `播放模式：${MODE_LABELS[mode]}`); } };
  const render = () => { const meta = Amplitude.getActiveSongMetadata?.() || tracks[current]; const played = Number(Amplitude.getSongPlayedSeconds?.() || 0); const total = Number(Amplitude.getSongDuration?.() || meta?.duration || 0); if (title) title.textContent = meta?.name || tracks[current].title; if (artist) artist.textContent = meta?.artist || tracks[current].artist; if (elapsed) elapsed.textContent = formatTime(played); if (duration) duration.textContent = formatTime(total); const ratio = total ? Math.min(1, played / total) : 0; if (fill) fill.style.width = `${ratio * 100}%`; if (thumb) thumb.style.left = `${ratio * 100}%`; if (progress) { progress.setAttribute('aria-valuemax', String(total)); progress.setAttribute('aria-valuenow', String(played)); } rows.forEach((row) => row.toggleAttribute('data-active', Number(row.dataset.trackIndex) === current)); };
  const play = (index = current) => { current = index; Amplitude.play(index); render(); };
  const onPlayPause = () => { if (Amplitude.getPlayerState?.() === 'playing') Amplitude.pause(); else play(current); render(); };
  const onMode = () => { mode = nextMode(mode); localStorage.setItem('music-playback-mode', mode); renderMode(); };
  const onVolume = () => { const value = Number(volume?.value || 0); Amplitude.setVolume(value); localStorage.setItem('music-volume', String(value)); };
  const onProgress = (event: Event) => { const rect = progress?.getBoundingClientRect(); const total = Number(Amplitude.getSongDuration?.() || 0); if (!rect || !total) return; const point = event instanceof KeyboardEvent ? (event.key === 'ArrowRight' ? .05 : event.key === 'ArrowLeft' ? -.05 : 0) : ((event as MouseEvent).clientX - rect.left) / rect.width; const ratio = event instanceof KeyboardEvent ? Math.min(1, Math.max(0, (Number(Amplitude.getSongPlayedSeconds?.() || 0) / total) + point)) : Math.min(1, Math.max(0, point)); Amplitude.setSongPlayedPercentage?.(ratio * 100); render(); };
  const onEnded = () => { const next = nextIndex({ mode, current, length: tracks.length }); if (next !== null) play(next); else render(); };
  const listeners: Array<[Element | null, string, EventListener]> = [[playPause, 'click', onPlayPause], [modeButton, 'click', onMode], [volume, 'input', onVolume], [progress, 'click', onProgress], [progress, 'keydown', onProgress]];
  listeners.forEach(([element, event, handler]) => element?.addEventListener(event, handler));
  rows.forEach((row) => row.querySelector('button')?.addEventListener('click', () => play(Number(row.dataset.trackIndex))));
  root.querySelector('[data-prev]')?.addEventListener('click', () => play((current - 1 + tracks.length) % tracks.length));
  root.querySelector('[data-next]')?.addEventListener('click', () => { const next = nextIndex({ mode, current, length: tracks.length }); if (next !== null) play(next); });
  Amplitude.bind('ended', onEnded); Amplitude.bind('timeupdate', render); renderMode(); render();
  const cleanup = () => { Amplitude.pause(); listeners.forEach(([element, event, handler]) => element?.removeEventListener(event, handler)); Amplitude.unbind?.('ended', onEnded); Amplitude.unbind?.('timeupdate', render); };
  cleanups.set(root, cleanup);
  return cleanup;
}

function initializeAll() { document.querySelectorAll<HTMLElement>('[data-music-player]').forEach(initialize); }
document.addEventListener('astro:page-load', initializeAll);
document.addEventListener('astro:before-swap', () => document.querySelectorAll<HTMLElement>('[data-music-player]').forEach((root) => cleanups.get(root)?.()));
initializeAll();
