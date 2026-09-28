import { isAuthenticated } from './auth';
import { isSameOrigin } from './security';

interface Env { GITHUB_TOKEN: string; GITHUB_OWNER: string; GITHUB_REPO: string; GITHUB_BRANCH?: string; ADMIN_USERNAME: string; ADMIN_PASSWORD: string }
interface GitHubFile { sha: string; name?: string; size?: number }
interface PublishInput { title?: unknown; body?: unknown; topic?: unknown; date?: unknown; tags?: unknown; description?: unknown; slug?: unknown; overwrite?: unknown }

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_TITLE_LENGTH = 200;
const MAX_TOPIC_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TAGS_LENGTH = 500;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const slugify = (value: string) => { const slug = value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return slug || `post-${Date.now()}`; };
const slugifyTopic = (value: string) => { const slug = value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return slug || `topic-${Array.from(value).map(char => char.codePointAt(0)!.toString(16)).join('-')}`; };
const TOPIC_SLUGS: Record<string, string> = { '诗集': 'poetry', '笔记': 'notes', '随笔': 'essays' };

function text(value: unknown, max: number, trim = true) {
  if (typeof value !== 'string') return '';
  const result = trim ? value.trim() : value;
  return result.length <= max ? result : '';
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function encodeBase64(bytes: Uint8Array) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 0x8000) value += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(value);
}

function removeLeadingFrontmatter(body: string) {
  return body.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\s*/, '');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.ADMIN_PASSWORD) return json({ error: '服务端尚未配置发布环境变量。' }, 500);
    if (!isSameOrigin(request)) return json({ error: '来源不受信任。' }, 403);
    if (!await isAuthenticated(request, env)) return json({ error: '请先登录控制台。' }, 401);

    const input = await request.json().catch(() => null) as PublishInput | null;
    if (!input) return json({ error: '发布请求格式无效。' }, 400);
    const title = text(input.title, MAX_TITLE_LENGTH);
    const rawBody = text(input.body, MAX_BODY_BYTES, false);
    const topic = text(input.topic, MAX_TOPIC_LENGTH);
    const date = text(input.date, 10);
    const tagsText = text(input.tags, MAX_TAGS_LENGTH);
    const description = text(input.description, MAX_DESCRIPTION_LENGTH);
    if (!title || !rawBody || !topic || !validDate(date)) return json({ error: '标题、正文、专题和有效日期不能为空。' }, 400);
    if ([title, topic, description].some(value => /[\r\n]/.test(value))) return json({ error: '标题、专题和摘要不能包含换行。' }, 400);
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: '文章正文过大。' }, 413);

    const tags = tagsText.split(/[,，]/).map(tag => tag.trim()).filter(Boolean);
    if (tags.length > 20 || tags.some(tag => tag.length > 50 || /[\r\n]/.test(tag))) return json({ error: '标签数量或长度超出限制。' }, 400);
    const slugInput = text(input.slug, 120);
    const slug = slugify(slugInput || title);
    const topicSlug = TOPIC_SLUGS[topic] || slugifyTopic(topic);
    const quote = (value: string) => JSON.stringify(value);
    const body = removeLeadingFrontmatter(rawBody);
    const markdown = ['---', `title: ${quote(title)}`, `date: ${date}`, `topic: ${quote(topic)}`, `topicSlug: ${quote(topicSlug)}`, `tags: [${tags.map(quote).join(', ')}]`, `description: ${quote(description)}`, '---', '', body].join('\n');
    const path = `src/content/posts/${slug}.md`;
    const api = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
    const branch = env.GITHUB_BRANCH || 'main';
    const headers = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'naichun-site-publisher', 'Content-Type': 'application/json' };
    const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
    const current = existing.ok ? await existing.json() as GitHubFile : undefined;
    if (current && input.overwrite !== 'true' && input.overwrite !== true) return json({ error: 'file_exists', message: '文件已存在', incoming: { name: `${slug}.md`, size: new TextEncoder().encode(markdown).byteLength, type: 'Markdown 文章' }, existing: { name: current.name || `${slug}.md`, size: current.size || 0, type: 'Markdown 文章' }, path }, 409);
    if (current && !current.sha) return json({ error: '无法读取现有文章版本，请稍后重试。' }, 502);
    const encoded = encodeBase64(new TextEncoder().encode(markdown));
    const response = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: `${current ? 'Update' : 'Add'} post: ${title}`, content: encoded, branch, ...(current ? { sha: current.sha } : {}) }) });
    if (response.status === 409 && current) return json({ error: '文章在确认期间已发生变化，请重新发布。' }, 409);
    if (!response.ok) return json({ error: `GitHub 发布失败（${response.status}）。` }, 502);
    return json({ ok: true, slug });
  } catch {
    return json({ error: '发布请求格式无效。' }, 400);
  }
};
