import { clearCredentialQuery } from './common';
import { initializeAuth } from './auth';
import { initializeSubplaylistSelector, initializeUploads } from './uploads';

const cleanups = new WeakMap<HTMLElement, () => void>();

function initializeConsole(): void {
  clearCredentialQuery();
  const root = document.querySelector<HTMLElement>('[data-console-root]');
  if (!root || cleanups.has(root)) return;

  const status = root.querySelector<HTMLElement>('[data-console-status]');
  const cleanup = [
    initializeAuth({ root, status }),
    initializeSubplaylistSelector(root),
    initializeUploads({ root, status }),
  ];
  cleanups.set(root, () => {
    cleanup.forEach((dispose) => dispose());
    cleanups.delete(root);
  });
}

document.addEventListener('astro:page-load', initializeConsole);
document.addEventListener('astro:before-swap', () => {
  document.querySelectorAll<HTMLElement>('[data-console-root]').forEach((root) => cleanups.get(root)?.());
});
initializeConsole();
