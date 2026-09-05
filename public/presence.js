(() => {
  const render = (status) => {
    const steam = document.querySelector('[data-presence="steam"]');
    const netease = document.querySelector('[data-presence="netease"]');
    if (!steam || !netease) return;
    steam.textContent = `Steam：${status.steamOnline ? '在线' : '离线'}`;
    steam.className = `presence-line ${status.steamOnline ? 'is-online' : 'is-offline'}`;
    const playing = status.neteaseState === 'playing' && status.song;
    netease.textContent = `网易云：${playing ? status.song : status.neteaseState === 'online' ? '在线' : '离线'}`;
    netease.className = `presence-line ${playing ? 'is-playing' : status.neteaseState === 'online' ? 'is-online' : 'is-offline'}`;
    try { localStorage.setItem('site-presence', JSON.stringify(status)); } catch { }
  };
  const refresh = async () => {
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      render(await response.json());
    } catch { render({ steamOnline: false, neteaseState: 'offline' }); }
  };
  if (!window.__presenceReady) {
    window.__presenceReady = true;
    window.setInterval(refresh, 15_000);
    document.addEventListener('astro:after-swap', refresh);
  }
  try {
    const cached = JSON.parse(localStorage.getItem('site-presence'));
    if (cached) render(cached);
  } catch { }
  refresh();
})();
