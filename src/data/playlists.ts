export interface PlaylistDefinition {
  slug: string;
  title: string;
  description: string;
  directory: string;
}

export const PLAYLISTS: readonly PlaylistDefinition[] = [
  {
    slug: 'electronic',
    title: '电音',
    description: '电子音乐歌单。',
    directory: 'electronic',
  },
  {
    slug: 'japanese-pop',
    title: '日系流行',
    description: '日系流行音乐歌单。',
    directory: 'japanese-pop',
  },
  {
    slug: 'chinese-pop',
    title: '华语流行',
    description: '华语流行音乐歌单。',
    directory: 'chinese-pop',
  },
  {
    slug: 'post-rock-punk',
    title: '后摇&后朋',
    description: '后摇与后朋音乐歌单。',
    directory: 'post-rock-punk',
  },
  {
    slug: 'phonk',
    title: 'Phonk',
    description: 'Phonk 音乐歌单。',
    directory: 'phonk',
  },
  {
    slug: 'math-rock',
    title: '数摇',
    description: '数学摇滚音乐歌单。',
    directory: 'math-rock',
  },
  {
    slug: 'midwest-emo',
    title: '中西部emo',
    description: '中西部 emo 音乐歌单。',
    directory: 'midwest-emo',
  },
  {
    slug: 'piano',
    title: 'Piano',
    description: '钢琴音乐歌单。',
    directory: 'piano',
  },
];

export function getPlaylist(slug: string): PlaylistDefinition | undefined {
  return PLAYLISTS.find((playlist) => playlist.slug === slug);
}
