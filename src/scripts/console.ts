function clearCredentialQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('username') || params.has('password')) {
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.hash}`);
  }
}

function initializeConsole() {
  clearCredentialQuery();
  const statusEl = document.querySelector<HTMLElement>('[data-console-status]');
  const login = document.querySelector<HTMLFormElement>('[data-login-form]');
  const panel = document.querySelector<HTMLElement>('[data-console-panel]');
  if (!statusEl || !login || !panel || login.dataset.initialized === 'true') return;
  login.dataset.initialized = 'true';

  const setState = (authenticated: boolean) => {
    login.hidden = authenticated;
    panel.hidden = !authenticated;
    statusEl.textContent = authenticated ? '已登录' : '请登录控制台';
  };

  fetch('/api/auth', { credentials: 'same-origin' })
    .then((response) => response.json())
    .then((data: { authenticated?: boolean }) => setState(data.authenticated === true))
    .catch(() => { statusEl.textContent = '无法连接认证服务。'; });

  login.addEventListener('submit', async (event) => {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(Object.fromEntries(new FormData(login))),
    });
    const data = await response.json();
    if (response.ok) setState(true);
    else statusEl.textContent = data.error || '登录失败';
  });

  panel.querySelector<HTMLButtonElement>('[data-logout]')?.addEventListener('click', async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'logout' }),
    });
    setState(false);
  });

  panel.querySelector<HTMLFormElement>('[data-post-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const body = new FormData(form);
    const file = body.get('bodyFile');
    if (!(file instanceof File)) { statusEl.textContent = '请选择 Markdown 正文文件。'; return; }
    body.delete('bodyFile');
    body.set('body', await file.text());
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(Object.fromEntries(body)),
    });
    const data = await response.json();
    statusEl.textContent = data.error || '文章已提交';
  });

  let pendingUpload: { formData: FormData; submitButton: HTMLButtonElement } | null = null;
  const conflict = document.querySelector<HTMLDialogElement>('[data-file-conflict]');
  const setConflict = (data: any) => { (conflict?.querySelector('[data-incoming-name]') as HTMLElement).textContent = data.incoming.name; (conflict?.querySelector('[data-incoming-meta]') as HTMLElement).textContent = `${data.incoming.size} B · ${data.incoming.type}`; (conflict?.querySelector('[data-existing-name]') as HTMLElement).textContent = data.existing.name; (conflict?.querySelector('[data-existing-meta]') as HTMLElement).textContent = `${data.existing.size} B · ${data.existing.type}`; };
  const submitMusicForm = async (form: HTMLFormElement, overwrite = false) => {
    const formData = new FormData(form); if (overwrite) formData.set('overwrite', 'true');
    event.preventDefault();
    const response = await fetch('/api/upload-music', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });
    const data = await response.json();
    if (response.status === 409 && data.error === 'file_exists') { pendingUpload = { formData, submitButton: form.querySelector('button[type="submit"]')! }; setConflict(data); conflict?.showModal(); return; }
    statusEl.textContent = data.error || (form.matches('[data-lrc-form]') ? '歌词已提交' : '音乐已提交'); if (response.ok) form.reset();
  };
  panel.querySelectorAll<HTMLFormElement>('[data-mp3-form],[data-lrc-form]').forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); submitMusicForm(form); }));
  conflict?.querySelector('[data-overwrite]')?.addEventListener('click', async () => { if (!pendingUpload) return; const formData = pendingUpload.formData; formData.set('overwrite', 'true'); const response = await fetch('/api/upload-music', { method: 'POST', credentials: 'same-origin', body: formData }); const data = await response.json(); conflict.close(); pendingUpload = null; statusEl.textContent = data.error || '音乐已提交'; });
  const cancel = () => { pendingUpload = null; conflict?.close(); statusEl.textContent = '已取消上传'; };
  conflict?.querySelector('[data-keep-existing]')?.addEventListener('click', cancel); conflict?.addEventListener('cancel', cancel); conflict?.addEventListener('close', () => { pendingUpload?.submitButton.focus(); pendingUpload = null; });
}

document.addEventListener('astro:page-load', initializeConsole);
initializeConsole();
