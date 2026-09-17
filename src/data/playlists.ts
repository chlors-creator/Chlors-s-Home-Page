import playlistConfig from "./playlists.json";

export interface PlaylistDefinition {
  slug: string;
  title: string;
  description: string;
  directory: string;
  children?: readonly PlaylistDefinition[];
}

export const PLAYLISTS = playlistConfig as readonly PlaylistDefinition[];

export function getPlaylist(slug: string): PlaylistDefinition | undefined {
  return PLAYLISTS.find((playlist) => playlist.slug === slug);
}

export function getPlaylistDirectories(): string[] {
  return PLAYLISTS.flatMap((playlist) => [
    playlist.directory,
    ...(playlist.children?.map((child) => child.directory) ?? []),
  ]);
}

export function getPlaylistChildren(
  slug: string,
): readonly PlaylistDefinition[] {
  return getPlaylist(slug)?.children ?? [];
}
