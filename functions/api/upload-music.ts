import { isAuthenticated } from './auth';
import { isSameOrigin } from './security';

interface Env { GITHUB_TOKEN: string; GITHUB_OWNER: string; GITHUB_REPO: string; GITHUB_BRANCH?: string; ADMIN_USERNAME: string; ADMIN_PASSWORD: string }
interface GitHubFile { name?: string; size?: number; sha?: string }

const dirs = new Set(['electronic', 'japanese-pop', 'vocaloid', 'chinese-pop', 'post-rock-punk', 'post-rock', 'russian-post-punk', 'english-post-punk', 'chinese-post-punk', 'phonk', 'math-rock', 'midwest-emo', 'piano']);
const subdirs = new Set(['post-rock', 'russian-post-punk', 'english-post-punk', 'chinese-post-punk']);
const MAX_MP3_BYTES = 25 * 1024 * 1024;
const MAX_LRC_BYTES = 1 * 1024 * 1024;
const MAX_REQUEST_BYTES = 30 * 1024 * 1024;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function encodeBase64(bytes: Uint8Array) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 0x8000) value += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(value);
}

function displayType(extension: string) { return extension === '.mp3' ? 'MP3 音频' : 'LRC 歌词'; }

async function hasMp3Header(file: File) {
  const header = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  return (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
}

async function hasTextContent(file: File) {
  const sample = new Uint8Array(await file.slice(0, Math.min(file.size, 4096)).arrayBuffer());
  return !sample.includes(0);
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!isSameOrigin(request)) return json({ error: '来源不受信任。' }, 403);
  if (!await isAuthenticated(request, env)) return json({ error: '请先登录控制台。' }, 401);

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return json({ error: '上传请求过大。' }, 413);

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: '上传请求格式无效。' }, 400);
  const file = form.get('file');
  const directory = String(form.get('directory') || '');
  const extension = file instanceof File ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  if (!(file instanceof File) || !['.mp3', '.lrc'].includes(extension) || !dirs.has(directory)) return json({ error: '请选择有效的 MP3 或 LRC 文件和歌单。' }, 400);

  const maxBytes = extension === '.mp3' ? MAX_MP3_BYTES : MAX_LRC_BYTES;
  if (file.size === 0 || file.size > maxBytes) return json({ error: `${displayType(extension)}大小超出限制。` }, 413);

  const parent = directory === 'post-rock-punk' ? String(form.get('subcategory') || '') : '';
  if (directory === 'post-rock-punk' && !subdirs.has(parent)) return json({ error: '请选择有效的后朋子歌单。' }, 400);
  if (extension === '.mp3' && !await hasMp3Header(file)) return json({ error: '文件内容不是有效的 MP3。' }, 400);
  if (extension === '.lrc' && !await hasTextContent(file)) return json({ error: 'LRC 文件必须是文本格式。' }, 400);

  const overwrite = form.get('overwrite') === 'true';
  const safeName = file.name.replace(/[^\p{L}\p{N}._() -]/gu, '_').slice(0, 180);
  if (!safeName || safeName === '.' || safeName === '..') return json({ error: '文件名无效。' }, 400);
  const path = `public/music/${directory}/${parent ? `${parent}/` : ''}${safeName}`;
  const api = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const branch = env.GITHUB_BRANCH || 'main';
  const headers = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'naichun-site-console', 'Content-Type': 'application/json' };

  const existingResponse = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  const existing = existingResponse.ok ? await existingResponse.json() as GitHubFile : undefined;
  if (existing && !overwrite) return json({ error: 'file_exists', message: '文件已存在', incoming: { name: safeName, size: file.size, type: displayType(extension) }, existing: { name: existing.name || safeName, size: existing.size || 0, type: displayType(extension) }, path }, 409);
  if (existing && !existing.sha) return json({ error: '无法读取现有文件版本，请稍后重试。' }, 502);

  const response = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: `${existing ? 'Update' : 'Add'} music: ${safeName}`, content: encodeBase64(new Uint8Array(await file.arrayBuffer())), branch, ...(existing ? { sha: existing.sha } : {}) }) });
  if (response.status === 409 && existing) return json({ error: '文件在确认期间已发生变化，请重新上传' }, 409);
  if (!response.ok) return json({ error: `GitHub 上传失败（${response.status}）。` }, 502);
  return json({ ok: true, path });
};
