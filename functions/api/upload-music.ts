import { isAuthenticated } from './auth';

interface Env { GITHUB_TOKEN: string; GITHUB_OWNER: string; GITHUB_REPO: string; GITHUB_BRANCH?: string; ADMIN_USERNAME: string; ADMIN_PASSWORD: string }
interface GitHubFile { name?: string; size?: number; sha?: string }
const dirs = new Set(['electronic','japanese-pop','vocaloid','chinese-pop','post-rock-punk','phonk','math-rock','midwest-emo','piano']);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

function encodeBase64(bytes: Uint8Array) { let value = ''; for (let i = 0; i < bytes.length; i += 0x8000) value += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(value); }
function displayType(extension: string) { return extension === '.mp3' ? 'MP3 音频' : 'LRC 歌词'; }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!await isAuthenticated(request, env)) return json({ error: '请先登录控制台。' }, 401);
  const form = await request.formData(); const file = form.get('file'); const directory = String(form.get('directory') || '');
  const extension = file instanceof File ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  if (!(file instanceof File) || !['.mp3', '.lrc'].includes(extension) || !dirs.has(directory)) return json({ error: '请选择有效的 MP3 或 LRC 文件和歌单。' }, 400);
  const overwrite = form.get('overwrite') === 'true'; const safeName = file.name.replace(/[^\p{L}\p{N}._() -]/gu, '_'); const path = `public/music/${directory}/${safeName}`;
  const api = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`; const branch = env.GITHUB_BRANCH || 'main';
  const headers = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'naichun-site-console', 'Content-Type': 'application/json' };
  const existingResponse = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers }); const existing = existingResponse.ok ? await existingResponse.json() as GitHubFile : undefined;
  if (existing && !overwrite) return json({ error: 'file_exists', message: '文件已存在', incoming: { name: safeName, size: file.size, type: displayType(extension) }, existing: { name: existing.name || safeName, size: existing.size || 0, type: displayType(extension) }, path }, 409);
  const response = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: `${existing ? 'Update' : 'Add'} music: ${safeName}`, content: encodeBase64(new Uint8Array(await file.arrayBuffer())), branch, ...(existing ? { sha: existing.sha } : {}) }) });
  if (response.status === 409 && existing) return json({ error: '文件在确认期间已发生变化，请重新上传' }, 409);
  if (!response.ok) return json({ error: `GitHub 上传失败（${response.status}）。` }, 502);
  return json({ ok: true, path });
};
