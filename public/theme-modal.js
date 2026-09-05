(() => {
  const themes = {
    paper: ['#e8e0d3', '#292a27', '#c9c0b2'],
    white: ['#ffffff', '#20211f', '#d7d7d3'],
    black: ['#242522', '#ece8df', '#42443f'],
    atori: ['rgba(255,255,255,.5)', '#29251f', 'rgba(65,54,42,.25)'],
    luoqian: ['rgba(255,255,255,.58)', '#29251f', 'rgba(65,54,42,.28)'],
  };
  const applyTheme = (name) => {
    const values = themes[name] || themes.paper;
    document.documentElement.dataset.themeChoice = name;
    document.documentElement.style.setProperty('--paper', values[0]);
    document.documentElement.style.setProperty('--ink', values[1]);
    document.documentElement.style.setProperty('--line', values[2]);
    localStorage.setItem('site-theme-choice', name);
  };
  const closeModal = (modal) => {
    modal.classList.add('is-closing');
    modal.addEventListener('animationend', () => modal.remove(), { once: true });
  };
  const restoreTheme = () => applyTheme(localStorage.getItem('site-theme-choice') || 'paper');
  restoreTheme();

  if (!window.__themeControlsReady) {
    window.__themeControlsReady = true;
    document.addEventListener('astro:after-swap', restoreTheme);
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || link.target === '_blank') return;
      const target = new URL(link.href, location.href);
      const normalizePath = (path) => path.replace(/\/+$/, '') || '/';
      const isCurrentPage = target.origin === location.origin
        && normalizePath(target.pathname) === normalizePath(location.pathname)
        && target.search === location.search
        && target.hash === location.hash;
      if (!isCurrentPage) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.theme-toggle');
      if (!button) return;
      if (document.querySelector('.theme-modal')) return;
      const modal = document.createElement('div');
      modal.className = 'theme-modal';
      modal.innerHTML = `<section class="theme-modal-panel" role="dialog" aria-modal="true" aria-label="选择主题"><h2 class="theme-modal-title">SELECT THEME / 选择主题</h2><div class="theme-options"><button class="theme-option" data-theme="paper"><span class="theme-swatch"></span><span class="theme-name">米黄色</span></button><button class="theme-option" data-theme="white"><span class="theme-swatch"></span><span class="theme-name">纯白色</span></button><button class="theme-option" data-theme="black"><span class="theme-swatch"></span><span class="theme-name">黑色</span></button><button class="theme-option" data-theme="atori"><span class="theme-swatch"></span><span class="theme-name">亚托莉</span></button><button class="theme-option" data-theme="luoqian"><span class="theme-swatch"></span><span class="theme-name">洛茜</span></button><button class="theme-option pending"><span class="theme-swatch"></span><span class="theme-name">待定主题 06</span></button></div></section>`;
      document.body.appendChild(modal);
      modal.querySelector(`[data-theme="${localStorage.getItem('site-theme-choice') || 'paper'}"]`)?.classList.add('is-selected');
      modal.addEventListener('click', (modalEvent) => {
        if (modalEvent.target === modal) closeModal(modal);
        const option = modalEvent.target.closest('.theme-option');
        if (!option || option.classList.contains('pending')) return;
        applyTheme(option.dataset.theme);
        closeModal(modal);
      });
    });
  }
})();

