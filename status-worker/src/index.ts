export interface Env {
  PRESENCE: DurableObjectNamespace<Presence>;
  STATUS_REPORT_TOKEN: string;
  /** Comma-separated HTTPS origins allowed to read the public status. */
  PUBLIC_SITE_ORIGINS?: string;
}

type StatusRecord = {
  steamOnline: boolean;
  neteaseState: 'offline' | 'online' | 'playing';
  song?: string;
  updatedAt: string;
};

const defaultOrigins = new Set(['https://chlors.cn', 'https://www.chlors.cn']);

export class Presence {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const status = await this.state.storage.get<StatusRecord>('status');
      const updatedAt = status ? Date.parse(status.updatedAt) : NaN;
      if (!status || !Number.isFinite(updatedAt) || Date.now() - updatedAt > 45_000) {
        return json({ steamOnline: false, neteaseState: 'offline', updatedAt: null });
      }
      return json(status);
    }

    if (request.method === 'POST') {
      const input = await request.json().catch(() => null) as Partial<StatusRecord> | null;
      if (!input || typeof input.steamOnline !== 'boolean' || !['offline', 'online', 'playing'].includes(input.neteaseState ?? '')) {
        return json({ error: '状态格式无效。' }, 400);
      }
      const status: StatusRecord = {
        steamOnline: input.steamOnline,
        neteaseState: input.neteaseState!,
        song: input.neteaseState === 'playing' ? String(input.song ?? '').slice(0, 100) : undefined,
        updatedAt: new Date().toISOString(),
      };
      await this.state.storage.put('status', status);
      return json({ ok: true });
    }

    return json({ error: 'Method Not Allowed' }, 405);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let result: Response;
    if (request.method === 'OPTIONS') {
      result = new Response(null, { status: 204 });
    } else if (request.method === 'POST' && !await timingSafeEqualText(request.headers.get('authorization'), `Bearer ${env.STATUS_REPORT_TOKEN}`)) {
      result = json({ error: '未授权。' }, 401);
    } else {
      const id = env.PRESENCE.idFromName('main');
      result = await env.PRESENCE.get(id).fetch(request);
    }
    return cors(result, request, env);
  },
};

function configuredOrigins(env: Env) {
  const values = env.PUBLIC_SITE_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean) ?? [];
  return values.length ? new Set(values) : defaultOrigins;
}

function cors(response: Response, request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  if (origin && !configuredOrigins(env).has(origin)) return json({ error: '来源不受信任。' }, 403);

  const headers = new Headers(response.headers);
  headers.set('vary', 'Origin');
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-headers', 'authorization, content-type');
    headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    headers.set('access-control-max-age', '600');
  }
  return new Response(response.body, { status: response.status, headers });
}

async function timingSafeEqualText(provided: string | null | undefined, expected: string): Promise<boolean> {
  if (typeof provided !== 'string') return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
