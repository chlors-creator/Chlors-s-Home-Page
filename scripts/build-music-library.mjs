import { createHash } from 'node:crypto';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PLAYLISTS = [
  ['electronic', 'electronic'], ['japanese-pop', 'japanese-pop'],
  ['vocaloid', 'vocaloid'],
  ['chinese-pop', 'chinese-pop'], ['post-rock-punk', 'post-rock-punk'],
  ['phonk', 'phonk'], ['math-rock', 'math-rock'],
  ['midwest-emo', 'midwest-emo'], ['piano', 'piano'],
];

function encodeUrlPath(path) {
  return path.split(/[\\/]+/).map(encodeURIComponent).join('/');
}

function imageExtension(mimeType) {
  const subtype = mimeType?.split('/')[1]?.toLowerCase();
  return subtype === 'jpeg' ? 'jpg' : subtype?.replace(/[^a-z0-9]/g, '') || 'jpg';
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseFilename(fileName) {
  const stem = basename(fileName, extname(fileName)).trim();
  const separator = stem.lastIndexOf(' - ');
  if (separator > 0) {
    const artist = stem.slice(0, separator).replace(/\s*,\s*/g, ' / ').trim();
    const title = stem.slice(separator + 3).trim();
    return { artist, title };
  }
  return { artist: '', title: stem };
}

function readArtists(common, fallbackArtist) {
  const artists = Array.isArray(common.artists) ? common.artists : [];
  const values = (artists.length ? artists : [common.artist, common.albumartist, fallbackArtist])
    .map(cleanText)
    .filter(Boolean);
  return [...new Set(values)].join(' / ') || '未知艺术家';
}

async function findMp3Files(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const matches = await Promise.all(entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) return findMp3Files(entryPath);
      return entry.isFile() && extname(entry.name).toLowerCase() === '.mp3' ? [entryPath] : [];
    }));
    return matches.flat();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function fallbackTitle(fileName) {
  return parseFilename(fileName).title;
}

export async function scanMusicLibrary({
  musicRoot = join(PROJECT_ROOT, 'public', 'music'),
  coversRoot = join(PROJECT_ROOT, 'public', 'generated', 'music-covers'),
} = {}) {
  await mkdir(coversRoot, { recursive: true });
  const playlists = {};

  for (const [slug, directory] of PLAYLISTS) {
    const playlistRoot = join(musicRoot, directory);
    const files = await findMp3Files(playlistRoot);
    files.sort((left, right) => relative(playlistRoot, left).localeCompare(relative(playlistRoot, right), 'zh-CN', { numeric: true }));
    playlists[slug] = [];

    for (const filePath of files) {
      try {
        const fileInfo = await stat(filePath);
        if (fileInfo.size < 1024) {
          console.warn(`Skipping empty MP3 placeholder ${filePath}`);
          continue;
        }
        const metadata = await parseFile(filePath, { duration: true });
        const fallback = parseFilename(filePath);
        const image = metadata.common.picture?.find((picture) => picture?.data?.length);
        let cover = '/generated/music-covers/default.svg';
        if (image?.data) {
          const coverName = `${createHash('sha1').update(image.data).digest('hex')}.${imageExtension(image.format || image.mime)}`;
          await writeFile(join(coversRoot, coverName), image.data);
          cover = `/generated/music-covers/${coverName}`;
        }
        const relativePath = relative(playlistRoot, filePath);
        const duration = Math.max(0, Math.floor(metadata.format.duration ?? 0));
        playlists[slug].push({
          id: createHash('sha1').update(`${slug}/${relativePath}`).digest('hex'),
          src: `/music/${encodeUrlPath(directory)}/${encodeUrlPath(relativePath)}`,
          cover,
          title: cleanText(metadata.common.title) || fallback.title,
          artist: readArtists(metadata.common, fallback.artist),
          duration,
          durationLabel: formatDuration(duration),
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
  const outputPath = join(PROJECT_ROOT, 'src', 'generated', 'music-library.json');
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(library, null, 2)}\n`);
  console.log(`Built music library with ${Object.values(library.playlists).flat().length} tracks.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
