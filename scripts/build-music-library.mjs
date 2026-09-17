import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFile } from "music-metadata";
import playlistConfig from "../src/data/playlists.json" with { type: "json" };

const PROJECT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PLAYLISTS = playlistConfig.map(({ slug, directory }) => [
  slug,
  directory,
]);
const PLAYLIST_CHILDREN = Object.fromEntries(
  playlistConfig
    .filter(({ children }) => children?.length)
    .map(({ slug, children }) => [
      slug,
      children.map(({ directory }) => directory),
    ]),
);

function encodeUrlPath(path) {
  return path
    .split(/[\\/]+/)
    .map(encodeURIComponent)
    .join("/");
}

function imageExtension(mimeType) {
  const subtype = mimeType?.split("/")[1]?.toLowerCase();
  return subtype === "jpeg"
    ? "jpg"
    : subtype?.replace(/[^a-z0-9]/g, "") || "jpg";
}

async function findFiles(directory, extension) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const matches = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) return findFiles(entryPath, extension);
        return entry.isFile() && extname(entry.name).toLowerCase() === extension
          ? [entryPath]
          : [];
      }),
    );
    return matches.flat();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function normalizedStem(filePath) {
  return basename(filePath, extname(filePath)).toLocaleLowerCase("en-US");
}

export function findMatchingLrc(mp3Path, lrcPaths) {
  const mp3Directory = dirname(mp3Path).toLocaleLowerCase("en-US");
  const mp3Stem = normalizedStem(mp3Path);
  return (
    lrcPaths.find(
      (lrcPath) =>
        dirname(lrcPath).toLocaleLowerCase("en-US") === mp3Directory &&
        normalizedStem(lrcPath) === mp3Stem,
    ) ?? null
  );
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function fallbackTitle(fileName) {
  return basename(fileName, extname(fileName));
}

export async function scanMusicLibrary({
  musicRoot = join(PROJECT_ROOT, "public", "music"),
  coversRoot = join(PROJECT_ROOT, "public", "generated", "music-covers"),
} = {}) {
  await mkdir(coversRoot, { recursive: true });
  const playlists = {};

  for (const [slug, directory] of PLAYLISTS) {
    const childDirectories = PLAYLIST_CHILDREN[slug] || [];
    if (childDirectories.length) {
      for (const child of childDirectories) {
        const childRoot = join(musicRoot, directory, child);
        const files = await findFiles(childRoot, ".mp3");
        const lrcFiles = await findFiles(childRoot, ".lrc");
        const key = `${slug}/${child}`;
        playlists[key] = [];
        for (const filePath of files) {
          try {
            const metadata = await parseFile(filePath, { duration: true });
            const image = metadata.common.picture?.[0];
            let cover = "/generated/music-covers/default.svg";
            if (image?.data) {
              const coverName = `${createHash("sha1").update(image.data).digest("hex")}.${imageExtension(image.format)}`;
              await writeFile(join(coversRoot, coverName), image.data);
              cover = `/generated/music-covers/${coverName}`;
            }
            const relativePath = relative(childRoot, filePath);
            const matchingLrc = findMatchingLrc(
              relativePath,
              lrcFiles.map((p) => relative(childRoot, p)),
            );
            const duration = Math.max(
              0,
              Math.floor(metadata.format.duration ?? 0),
            );
            playlists[key].push({
              id: createHash("sha1")
                .update(`${key}/${relativePath}`)
                .digest("hex"),
              src: `/music/${encodeUrlPath(directory)}/${encodeUrlPath(child)}/${encodeUrlPath(relativePath)}`,
              lyricsSrc: matchingLrc
                ? `/music/${encodeUrlPath(directory)}/${encodeUrlPath(child)}/${encodeUrlPath(matchingLrc)}`
                : null,
              cover,
              title: metadata.common.title?.trim() || fallbackTitle(filePath),
              artist: metadata.common.artist?.trim() || "未知艺术家",
              duration,
              durationLabel: formatDuration(duration),
            });
          } catch (error) {
            console.warn(
              `Skipping unreadable MP3 ${filePath}: ${error.message}`,
            );
          }
        }
      }
    }
    const playlistRoot = join(musicRoot, directory);
    const files = await findFiles(playlistRoot, ".mp3");
    const lrcFiles = await findFiles(playlistRoot, ".lrc");
    files.sort((left, right) =>
      relative(playlistRoot, left).localeCompare(
        relative(playlistRoot, right),
        "zh-CN",
        { numeric: true },
      ),
    );
    playlists[slug] = [];

    for (const filePath of files) {
      try {
        const metadata = await parseFile(filePath, { duration: true });
        const image = metadata.common.picture?.[0];
        let cover = "/generated/music-covers/default.svg";
        if (image?.data) {
          const coverName = `${createHash("sha1").update(image.data).digest("hex")}.${imageExtension(image.format)}`;
          await writeFile(join(coversRoot, coverName), image.data);
          cover = `/generated/music-covers/${coverName}`;
        }
        const relativePath = relative(playlistRoot, filePath);
        const matchingLrc = findMatchingLrc(
          relativePath,
          lrcFiles.map((lrcPath) => relative(playlistRoot, lrcPath)),
        );
        const duration = Math.max(0, Math.floor(metadata.format.duration ?? 0));
        playlists[slug].push({
          id: createHash("sha1")
            .update(`${slug}/${relativePath}`)
            .digest("hex"),
          src: `/music/${encodeUrlPath(directory)}/${encodeUrlPath(relativePath)}`,
          cover,
          title: metadata.common.title?.trim() || fallbackTitle(filePath),
          artist: metadata.common.artist?.trim() || "未知艺术家",
          duration,
          durationLabel: formatDuration(duration),
          lyricsSrc: matchingLrc
            ? `/music/${encodeUrlPath(directory)}/${encodeUrlPath(matchingLrc)}`
            : null,
        });
      } catch (error) {
        console.warn(`Skipping unreadable MP3 ${filePath}: ${error.message}`);
      }
    }
  }
  return { generatedAt: new Date().toISOString(), playlists };
}

async function build() {
  const library = await scanMusicLibrary();
  const outputPath = join(
    PROJECT_ROOT,
    "src",
    "generated",
    "music-library.json",
  );
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(library, null, 2)}\n`);
  console.log(
    `Built music library with ${Object.values(library.playlists).flat().length} tracks.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  build().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
