interface DurableObjectStateLike {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): string;
  get(id: string): {
    fetch(request: Request): Promise<Response>;
  };
}

export interface Env {
  PRESENCE: DurableObjectNamespaceLike;
  STATUS_REPORT_TOKEN: string;
}

type StatusRecord = {
  steamOnline: boolean;
  neteaseState: "offline" | "online" | "playing";
  song?: string;
  updatedAt: string;
};

export class Presence {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      const status = await this.state.storage.get<StatusRecord>("status");
      if (!status || Date.now() - Date.parse(status.updatedAt) > 15_000) {
        return json({
          steamOnline: false,
          neteaseState: "offline",
          updatedAt: null,
        });
      }
      return json(status);
    }

    if (request.method === "POST") {
      const input = (await request.json()) as Partial<StatusRecord>;
      if (
        typeof input.steamOnline !== "boolean" ||
        !["offline", "online", "playing"].includes(input.neteaseState ?? "")
      ) {
        return json({ error: "状态格式无效。" }, 400);
      }
      const status: StatusRecord = {
        steamOnline: input.steamOnline,
        neteaseState: input.neteaseState!,
        song:
          input.neteaseState === "playing"
            ? String(input.song ?? "").slice(0, 100)
            : undefined,
        updatedAt: new Date().toISOString(),
      };
      await this.state.storage.put("status", status);
      return json({ ok: true });
    }

    return json({ error: "Method Not Allowed" }, 405);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS")
      return cors(new Response(null, { status: 204 }));
    if (
      request.method === "POST" &&
      request.headers.get("authorization") !==
        `Bearer ${env.STATUS_REPORT_TOKEN}`
    ) {
      return json({ error: "未授权。" }, 401);
    }
    const id = env.PRESENCE.idFromName("main");
    return cors(await env.PRESENCE.get(id).fetch(request));
  },
};

function cors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "authorization, content-type");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  return new Response(response.body, { status: response.status, headers });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
