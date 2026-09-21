(() => {
  const statusEndpoint = 'https://status.chlors.cn/api/status';
  let latestStatus = null;

  const render = (status, root = document) => {
    latestStatus = status;
    try { localStorage.setItem('site-presence', JSON.stringify(status)); } catch { }

    const steam = root.querySelector('[data-presence="steam"]');
    const netease = root.querySelector('[data-presence="netease"]');
    if (!steam || !netease) return;
    steam.textContent = `Steam：${status.steamOnline ? '在线' : '离线'}`;
    steam.className = `presence-line ${status.steamOnline ? 'is-online' : 'is-offline'}`;
    const playing = status.neteaseState === 'playing' && status.song;
    netease.textContent = `网易云：${playing ? status.song : status.neteaseState === 'online' ? '在线' : '离线'}`;
    netease.className = `presence-line ${playing ? 'is-playing' : status.neteaseState === 'online' ? 'is-online' : 'is-offline'}`;
  };
  const restoreLatest = (root = document) => {
    if (latestStatus) {
      render(latestStatus, root);
      return;
    }
    try {
      const cached = JSON.parse(localStorage.getItem('site-presence'));
      if (cached) {
        render(cached, root);
        return;
      }
    } catch { }
  };
  const refresh = async () => {
    restoreLatest();
    try {
      const response = await fetch(`${statusEndpoint}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      render(await response.json());
    } catch {
      if (!latestStatus) render({ steamOnline: false, neteaseState: 'offline' });
    }
  };
  if (!window.__presenceReady) {
    window.__presenceReady = true;
    window.setInterval(refresh, 5_000);
    document.addEventListener('astro:before-swap', (event) => {
      if (event.newDocument) restoreLatest(event.newDocument);
    });
    document.addEventListener('astro:after-swap', () => {
      restoreLatest();
      refresh();
    });
  }
  restoreLatest();
  refresh();
})();
