import { encodeTextBase64 } from "../lib/base64";
import { json } from "../lib/http";
import { readGitHubFile, writeGitHubFile, type GitHubEnv } from "../lib/github";
import { isAuthenticated } from "./auth";

interface Env extends GitHubEnv {
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `post-${Date.now()}`;
};

const slugifyTopic = (value: string) => {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (
    slug ||
    `topic-${Array.from(value)
      .map((char) => char.codePointAt(0)!.toString(16))
      .join("-")}`
  );
};

const TOPIC_SLUGS: Record<string, string> = {
  诗集: "poetry",
  笔记: "notes",
  随笔: "essays",
};

export const onRequestPost = async ({ request, env }: RequestContext) => {
  try {
    const input = (await request.json()) as Record<string, string>;
    if (
      !env.GITHUB_TOKEN ||
      !env.GITHUB_OWNER ||
      !env.GITHUB_REPO ||
      !env.ADMIN_PASSWORD
    )
      return json({ error: "服务端尚未配置发布环境变量。" }, 500);
    if (!(await isAuthenticated(request, env)))
      return json({ error: "请先登录控制台。" }, 401);
    if (!input.title || !input.body || !input.topic || !input.date)
      return json({ error: "标题、正文、日期和专题不能为空。" }, 400);
    const slug = slugify(input.slug || input.title);
    const topic = input.topic.trim();
    const topicSlug = TOPIC_SLUGS[topic] || slugifyTopic(topic);
    const tags = (input.tags || "")
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const quote = (value: string) => `"${value.replaceAll('"', '\\"')}` + '"';
    const markdown = [
      "---",
      `title: ${quote(input.title)}`,
      `date: ${input.date}`,
      `topic: ${quote(topic)}`,
      `topicSlug: ${quote(topicSlug)}`,
      `tags: [${tags.map(quote).join(", ")}]`,
      `description: ${quote(input.description || "")}`,
      "---",
      "",
      input.body,
    ].join("\n");
    const path = `src/content/posts/${slug}.md`;
    const existing = await readGitHubFile({
      env,
      path,
      userAgent: "naichun-site-publisher",
    });
    const current = existing.file;

    if (current && input.overwrite !== "true") {
      return json(
        {
          error: "file_exists",
          message: "文件已存在",
          incoming: {
            name: `${slug}.md`,
            size: new TextEncoder().encode(markdown).byteLength,
            type: "Markdown 文章",
          },
          existing: {
            name: current.name || `${slug}.md`,
            size: current.size || 0,
            type: "Markdown 文章",
          },
          path,
        },
        409,
      );
    }

    const response = await writeGitHubFile({
      env,
      path,
      userAgent: "naichun-site-publisher",
      message: `${current ? "Update" : "Add"} post: ${input.title}`,
      content: encodeTextBase64(markdown),
      sha: current?.sha,
    });

    if (!response.ok)
      return json({ error: `GitHub 发布失败（${response.status}）。` }, 502);
    return json({ ok: true, slug });
  } catch {
    return json({ error: "发布请求格式无效。" }, 400);
  }
};
