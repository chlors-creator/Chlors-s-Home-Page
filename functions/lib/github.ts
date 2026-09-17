export interface GitHubEnv {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH?: string;
}

export interface GitHubFile {
  name?: string;
  size?: number;
  sha?: string;
}

interface GitHubContentOptions {
  env: GitHubEnv;
  path: string;
  userAgent: string;
}

interface WriteGitHubFileOptions extends GitHubContentOptions {
  content: string;
  message: string;
  sha?: string;
}

export function getGitHubBranch(env: GitHubEnv): string {
  return env.GITHUB_BRANCH || "main";
}

export function getGitHubContentUrl(env: GitHubEnv, path: string): string {
  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
}

function getGitHubHeaders(
  env: GitHubEnv,
  userAgent: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": userAgent,
    "Content-Type": "application/json",
  };
}

export async function readGitHubFile({
  env,
  path,
  userAgent,
}: GitHubContentOptions): Promise<{
  file?: GitHubFile;
  url: string;
  branch: string;
}> {
  const url = getGitHubContentUrl(env, path);
  const branch = getGitHubBranch(env);
  const response = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
    headers: getGitHubHeaders(env, userAgent),
  });

  return {
    file: response.ok ? ((await response.json()) as GitHubFile) : undefined,
    url,
    branch,
  };
}

export function writeGitHubFile({
  env,
  path,
  content,
  message,
  sha,
  userAgent,
}: WriteGitHubFileOptions): Promise<Response> {
  const branch = getGitHubBranch(env);
  const body = {
    message,
    content,
    branch,
    ...(sha ? { sha } : {}),
  };

  return fetch(getGitHubContentUrl(env, path), {
    method: "PUT",
    headers: getGitHubHeaders(env, userAgent),
    body: JSON.stringify(body),
  });
}
