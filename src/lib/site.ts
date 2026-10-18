/**
 * 站点自身的品牌常量 —— **客户端安全**。
 *
 * 为什么单独拆一个模块：`SITE` 被 `layout.tsx`、`manifest.ts`、`robots.txt`、
 * `canonical.ts`、页脚、侧栏等十几处引用，其中 `site-sidebar.tsx` 与
 * `site-footer.tsx` 会被拉进客户端组件树。它们原先从 `@/lib/data` 取 `SITE`，
 * 而 `lib/data.ts` 一上来就把 2081 条工具、26 个分类、14 MB prose 全部 import
 * 进来 —— 这条链路正是「约 1.4 MB 内容 JSON 被打进 layout chunk」的根因之一。
 *
 * 把品牌常量搬到独立模块后，任何只需要站名/域名的地方都不再触碰目录数据。
 * `lib/data.ts` 继续 re-export `SITE`，23 处既有 import 一行都不用改。
 *
 * 注意：改这里就是改全站的站名、域名与 SEO 文案（它喂给 layout 的 metadata、
 * sitemap、robots.txt 以及各路由的 generateMetadata）。
 *
 * 品牌取面试界 TryWorld（`~/.claude/skills/tryworld-brand`，v1.4.0）。站名是
 * 「主品牌 + 品类后缀」的形式，`name` 与 `url` 是唯一事实来源。
 */
export const SITE = {
  name: '试界导航',
  url: 'https://nav.tryworld.com.cn',
  title: '试界导航 - 探索发现热门的智能体和AI工具',
  description:
    '试界导航是专注于智能体和AI工具的门户网站，我们致力于为用户介绍最新、热门的智能体和AI工具，帮助用户快速找到适合自己的学习、工作、生活的AI利器。',
  keywords: [
    '试界导航',
    '试界导航官网',
    'tryworld.com.cn',
    '试界',
    'TryWorld',
    '智能体',
    'AI工具',
    'AI导航',
    'AI工具导航',
    'AI工具推荐',
    '智能体导航',
    '智能体大全',
  ] as string[],
  ogImage: '/assets/site/og.png',
} as const;
