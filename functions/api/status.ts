import { json } from "../lib/http";

interface StatusRecord {
  steamOnline: boolean;
  neteaseState: "offline" | "online" | "playing";
  song?: string;
  updatedAt: string;
}
interface StatusKv {
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(
    key: string,
    value: string,
    options: { expirationTtl: number },
  ): Promise<void>;
}

interface Env {
  STATUS_KV: StatusKv;
  STATUS_REPORT_TOKEN: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const response = (body: unknown, status = 200) =>
  json(body, status, { "cache-control": "no-store" });
const offline = () =>
  response({ steamOnline: false, neteaseState: "offline", updatedAt: null });

export const onRequestGet = async ({ env }: Pick<RequestContext, "env">) => {
  if (!env.STATUS_KV) return offline();
  const status = await env.STATUS_KV.get<StatusRecord>("presence", "json");
  if (!status || Date.now() - Date.parse(status.updatedAt) > 45_000)
    return offline();
  return response(status);
};

export const onRequestPost = async ({ request, env }: RequestContext) => {
  if (!env.STATUS_KV || !env.STATUS_REPORT_TOKEN)
    return response({ error: "状态服务尚未配置。" }, 503);
  if (
    request.headers.get("authorization") !== `Bearer ${env.STATUS_REPORT_TOKEN}`
  )
    return response({ error: "未授权。" }, 401);
  const input = (await request.json()) as Partial<StatusRecord>;
  if (
    typeof input.steamOnline !== "boolean" ||
    !["offline", "online", "playing"].includes(input.neteaseState ?? "")
  )
    return response({ error: "状态格式无效。" }, 400);
  const status: StatusRecord = {
    steamOnline: input.steamOnline,
    neteaseState: input.neteaseState!,
    song:
      input.neteaseState === "playing"
        ? String(input.song ?? "").slice(0, 100)
        : undefined,
    updatedAt: new Date().toISOString(),
  };
  await env.STATUS_KV.put("presence", JSON.stringify(status), {
    expirationTtl: 120,
  });
  return response({ ok: true });
};
