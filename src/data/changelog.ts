export interface ChangeLogEntry {
  slug: string;
  title: string;
  appliedAt: string;
  details: string[];
}

export const changeLog: ChangeLogEntry[] = [
  {
    slug: 'improve-presence-and-links',
    title: '完善状态上报与友链页面',
    appliedAt: '2026-09-07T16:48:00+08:00',
    details: [
      '侧边栏新增 Steam 客户端在线状态与网易云音乐播放状态。',
      '本地状态上报器改为每 5 秒更新，并提供桌面快捷方式用于休眠后手动重启。',
      '网易云歌曲名统一使用 UTF-8 传输，支持法语、西班牙语、俄语、日语及其他 Unicode 字符。',
      '友链页面改为与专题页面一致的卡片网格设计。',
      '新增“Phaleristics in China”友链，描述为“勋章中国·论坛”。',
    ],
  },
  {
    slug: 'persist-avatar-and-limit-edge-line',
    title: '优化头像跨页加载',
    appliedAt: '2026-09-05T13:10:00+08:00',
    details: [
      '跨页面切换时复用同一个头像图片节点，避免头像重新加载或闪烁。',
    ],
  },
  {
    slug: 'refine-navigation-transition-edge',
    title: '避免当前页重复导航',
    appliedAt: '2026-09-05T13:09:00+08:00',
    details: [
      '点击侧边栏中指向当前页面的链接时，不再重新加载或播放换页动画。',
    ],
  },
  {
    slug: 'redesign-change-log',
    title: '重构日志页面',
    appliedAt: '2026-09-05T13:06:00+08:00',
    details: [
      '将日志列表改为与归档一致的日期、标题和箭头布局。',
      '新增独立的改动详情页，展示改动内容与精确到分钟的应用时间。',
      '日志与文章上传系统保持独立，不提供上传文章入口。',
    ],
  },
  {
    slug: 'remove-placeholder-post',
    title: '删除示例空文章',
    appliedAt: '2026-09-05T12:59:00+08:00',
    details: [
      '删除示例文章“把这里换成你的第一篇文章”。',
      '移除主页的 LATEST RECORDS 占位区块。',
      '清理 Astro 内容缓存，使归档、专题与文章路由同步更新。',
    ],
  },
  {
    slug: 'fix-page-transition-cache',
    title: '修复页面动画与主题资源缓存',
    appliedAt: '2026-09-05T03:18:00+08:00',
    details: [
      '移除 Astro 自动注入的默认淡入淡出动画。',
      '改用独立的正文右侧滑入过渡。',
      '为主题样式和脚本增加资源版本号，避免浏览器继续使用旧缓存。',
    ],
  },
  {
    slug: 'cover-old-page-content',
    title: '修复切页时旧内容透出',
    appliedAt: '2026-09-05T03:05:00+08:00',
    details: [
      '新内容从右侧切入时，同步裁切下方的旧内容。',
      '保持侧边栏、背景图片和主内容底色静止。',
    ],
  },
  {
    slug: 'preserve-theme-between-pages',
    title: '修复切页后主题失效',
    appliedAt: '2026-09-05T02:55:00+08:00',
    details: [
      '切页后重新应用已保存的图片主题。',
      '主题按钮改用事件委托，页面切换后仍可操作。',
      '启用 Astro 客户端路由，避免背景图片随整页刷新重新加载。',
    ],
  },
];

export const formatChangeDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

export const formatChangeTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
