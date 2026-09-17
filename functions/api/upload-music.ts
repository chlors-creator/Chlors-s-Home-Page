import {
  getPlaylistChildren,
  getPlaylistDirectories,
} from "../../src/data/playlists";
import { isAuthenticated } from "./auth";
import { encodeBase64 } from "../lib/base64";
import { json } from "../lib/http";
import { readGitHubFile, writeGitHubFile, type GitHubEnv } from "../lib/github";

interface Env extends GitHubEnv {
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}
const playlistDirectories = new Set(getPlaylistDirectories());
const postRockDirectories = new Set(
  getPlaylistChildren("post-rock-punk").map(({ directory }) => directory),
);

function displayType(extension: string) {
  return extension === ".mp3" ? "MP3 音频" : "LRC 歌词";
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  if (!(await isAuthenticated(request, env)))
    return json({ error: "请先登录控制台。" }, 401);
  const form = await request.formData();
  const file = form.get("file");
  const directory = String(form.get("directory") || "");
  const extension =
    file instanceof File
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : "";

  if (
    !(file instanceof File) ||
    ![".mp3", ".lrc"].includes(extension) ||
    !playlistDirectories.has(directory)
  ) {
    return json({ error: "请选择有效的 MP3 或 LRC 文件和歌单。" }, 400);
  }

  const overwrite = form.get("overwrite") === "true";
  const parent =
    directory === "post-rock-punk" ? String(form.get("subcategory") || "") : "";
  if (directory === "post-rock-punk" && !postRockDirectories.has(parent)) {
    return json({ error: "请选择有效的后摇/后朋子歌单。" }, 400);
  }
  const safeName = file.name.replace(/[^\p{L}\p{N}._() -]/gu, "_");
  const path = `public/music/${directory}/${parent ? `${parent}/` : ""}${safeName}`;
  const existing = await readGitHubFile({
    env,
    path,
    userAgent: "naichun-site-console",
  });

  if (existing.file && !overwrite) {
    return json(
      {
        error: "file_exists",
        message: "文件已存在",
        incoming: {
          name: safeName,
          size: file.size,
          type: displayType(extension),
        },
        existing: {
          name: existing.file.name || safeName,
          size: existing.file.size || 0,
          type: displayType(extension),
        },
        path,
      },
      409,
    );
  }

  const response = await writeGitHubFile({
    env,
    path,
    userAgent: "naichun-site-console",
    message: `${existing.file ? "Update" : "Add"} music: ${safeName}`,
    content: encodeBase64(new Uint8Array(await file.arrayBuffer())),
    sha: existing.file?.sha,
  });

  if (response.status === 409 && existing.file) {
    return json({ error: "文件在确认期间已发生变化，请重新上传" }, 409);
  }
  if (!response.ok)
    return json({ error: `GitHub 上传失败（${response.status}）。` }, 502);
  return json({ ok: true, path });
};
