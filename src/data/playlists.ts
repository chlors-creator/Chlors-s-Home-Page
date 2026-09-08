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
    description: '10s~20s，多流派集合',
    directory: 'electronic',
  },
  {
    slug: 'japanese-pop',
    title: '日系流行',
    description: '日系流行音乐歌单。',
    directory: 'japanese-pop',
  },
  {
    slug: 'vocaloid',
    title: 'Vocaloid',
    description: '术力口，Yamaha开发的虚拟歌姬',
    directory: 'vocaloid',
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
    description: '宏大与崩塌，后现代性Lo-fi音乐组合',
    directory: 'post-rock-punk',
  },
  {
    slug: 'phonk',
    title: 'Phonk',
    description: '牛铃，贝斯线与碎片旋律',
    directory: 'phonk',
  },
  {
    slug: 'math-rock',
    title: '数摇',
    description: '不对称拍型、不规则停顿，编曲复杂的实验摇滚',
    directory: 'math-rock',
  },
  {
    slug: 'midwest-emo',
    title: '中西部emo',
    description: '明亮旋律与忧伤内心，源自美国中西部的情绪摇滚',
    directory: 'midwest-emo',
  },
  {
    slug: 'piano',
    title: 'Piano',
    description: '轻音乐&轻古典',
    directory: 'piano',
  },
];

export function getPlaylist(slug: string): PlaylistDefinition | undefined {
  return PLAYLISTS.find((playlist) => playlist.slug === slug);
}
