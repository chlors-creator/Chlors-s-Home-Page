import { readResponse, setConflictContent, toast, type ConflictResponse } from './common';

type UploadKind = 'article' | 'music';

interface PendingUpload {
  form: HTMLFormElement;
  formData: FormData;
  kind: UploadKind;
  submitButton: HTMLButtonElement;
}

interface UploadElements {
  root: HTMLElement;
  status: HTMLElement | null;
}

const SUBPLAYLISTS = [
  ['post-rock', '后摇'],
  ['russian-post-punk', '俄语后朋'],
  ['english-post-punk', '英语后朋'],
  ['chinese-post-punk', '华语后朋'],
] as const;

async function request(endpoint: string, body: BodyInit, json = false): Promise<{ response: Response; data: Record<string, any> }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: json ? { 'content-type': 'application/json' } : undefined,
    credentials: 'same-origin',
    body,
  });
  return { response, data: await readResponse(response) };
}

function isConflict(data: Record<string, any>): data is ConflictResponse {
  return data.error === 'file_exists' && Boolean(data.incoming && data.existing);
}

export function initializeSubplaylistSelector(root: HTMLElement): () => void {
  const bindings: Array<{ select: HTMLSelectElement; field: HTMLLabelElement; onChange: () => void }> = [];

  root.querySelectorAll<HTMLSelectElement>('select[name="directory"]').forEach((select) => {
    const field = document.createElement('label');
    field.hidden = true;
    field.textContent = '子歌单';

    const subplaylist = document.createElement('select');
    subplaylist.name = 'subcategory';
    for (const [value, label] of SUBPLAYLISTS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      subplaylist.append(option);
    }
    field.append(subplaylist);
    select.closest('label')?.after(field);

    const onChange = () => { field.hidden = select.value !== 'post-rock-punk'; };
    select.addEventListener('change', onChange);
    bindings.push({ select, field, onChange });
  });

  return () => {
    bindings.forEach(({ select, field, onChange }) => {
      select.removeEventListener('change', onChange);
      field.remove();
    });
  };
}

export function initializeUploads({ root, status }: UploadElements): () => void {
  const post = root.querySelector<HTMLFormElement>('[data-post-form]');
  const musicForms = [...root.querySelectorAll<HTMLFormElement>('[data-mp3-form],[data-lrc-form]')];
  const conflict = root.querySelector<HTMLDialogElement>('[data-file-conflict]');
  let pending: PendingUpload | null = null;

  const showConflict = (upload: PendingUpload, data: ConflictResponse) => {
    if (!conflict) return false;
    pending = upload;
    setConflictContent(conflict, data);
    conflict.showModal();
    return true;
  };

  const submitArticle = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const file = formData.get('bodyFile');
    if (!(file instanceof File)) {
      toast(status, '请选择 Markdown 正文文件。');
      return;
    }
    formData.delete('bodyFile');
    formData.set('body', await file.text());
    const { response, data } = await request('/api/publish', JSON.stringify(Object.fromEntries(formData)), true);
    if (response.status === 409 && isConflict(data) && showConflict({ form, formData, kind: 'article', submitButton: form.querySelector('button[type="submit"]')! }, data)) return;
    toast(status, data.error || '文章已提交', response.ok ? 'success' : 'error');
    if (response.ok) form.reset();
  };

  const submitMusic = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const { response, data } = await request('/api/upload-music', formData);
    if (response.status === 409 && isConflict(data) && showConflict({ form, formData, kind: 'music', submitButton: form.querySelector('button[type="submit"]')! }, data)) return;
    toast(status, data.error || '上传已提交', response.ok ? 'success' : 'error');
    if (response.ok) form.reset();
  };

  const onPostSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    void submitArticle(event.currentTarget as HTMLFormElement);
  };
  post?.addEventListener('submit', onPostSubmit);

  const musicSubmitHandlers = new Map<HTMLFormElement, (event: SubmitEvent) => void>();
  musicForms.forEach((form) => {
    const handler = (event: SubmitEvent) => {
      event.preventDefault();
      void submitMusic(event.currentTarget as HTMLFormElement);
    };
    musicSubmitHandlers.set(form, handler);
    form.addEventListener('submit', handler);
  });

  const onOverwrite = async () => {
    if (!pending) return;
    pending.formData.set('overwrite', 'true');
    const upload = pending;
    const body = upload.kind === 'article' ? JSON.stringify(Object.fromEntries(upload.formData)) : upload.formData;
    const { response, data } = await request(upload.kind === 'article' ? '/api/publish' : '/api/upload-music', body, upload.kind === 'article');
    conflict?.close();
    toast(status, data.error || '上传已提交', response.ok ? 'success' : 'error');
    if (response.ok) upload.form.reset();
    pending = null;
  };

  const cancel = () => {
    pending?.submitButton.focus();
    pending = null;
    conflict?.close();
    toast(status, '已取消上传', 'error');
  };
  const overwrite = conflict?.querySelector('[data-overwrite]');
  const keepExisting = conflict?.querySelector('[data-keep-existing]');
  overwrite?.addEventListener('click', onOverwrite);
  keepExisting?.addEventListener('click', cancel);
  conflict?.addEventListener('cancel', cancel);

  return () => {
    post?.removeEventListener('submit', onPostSubmit);
    musicSubmitHandlers.forEach((handler, form) => form.removeEventListener('submit', handler));
    overwrite?.removeEventListener('click', onOverwrite);
    keepExisting?.removeEventListener('click', cancel);
    conflict?.removeEventListener('cancel', cancel);
    pending = null;
  };
}
