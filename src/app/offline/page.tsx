import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Bookmark, Home, LayoutGrid, WifiOff } from 'lucide-react';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

/**
 * 断网兜底页。
 *
 * 为什么需要它：`public/sw.js` 的导航策略是「网络优先，失败回退」，回退目标
 * 就是这里。没有这一页，断网时读者看到的是 Chrome 的恐龙页或 Safari 的
 * 「无法连接到服务器」—— 既没有站名，也没有任何出口，只能关掉标签。
 * 有它，至少能把「还能去哪儿」讲清楚。
 *
 * 静态导出下它就是 `out/offline.html`，由 Cloudflare Workers Static Assets
 * 按无扩展名的 `/offline` 提供；Service Worker 预缓存的也正是这个路径。
 *
 * SEO：`robots: { index: false }`，且**不进 `sitemap.ts`**。
 * 这一页只在断网时可读，搜索引擎抓到的永远是「你断网了」；收录它等于让
 * 搜索结果标题里多一句错误提示。`robots.txt` 里另有 `Disallow: /offline`
 * 作为第二道（`robots` 元数据与 robots.txt 各管一摊，改写规则不同）。
 */
export const metadata: Metadata = withOg(
  {
  ...canonical('/offline'),
  title: '当前离线',
  description: '网络连接已断开，恢复网络后刷新页面即可继续浏览试界导航。',
  robots: { index: false },
  },
  '/offline',
);

/**
 * 三个出口，按「最可能是你现在想要的」排序：回首页、翻目录、看本机收藏。
 * 收藏排在这里不是凑数 —— 它是全站唯一**完全不依赖网络**的数据（存在
 * localStorage），断网时它是唯一真正能用的入口。
 *
 * 文案里刻意不写「共 2081 个工具」这类数字：硬编码的计数每周都在变，
 * 而这一页是断网时才出现的，改数字的人不会想起来这里还有一份。
 */
const LINKS = [
  {
    href: '/',
    label: '返回首页',
    hint: '热门工具、分类导航与最新 AI 资讯的入口',
    icon: Home,
  },
  {
    href: '/tools',
    label: '浏览全部工具',
    hint: '按分类、标签或关键词筛选整个目录',
    icon: LayoutGrid,
  },
  {
    href: '/favorites',
    label: '我的收藏',
    hint: '存在这台设备上，不需要网络也不需要登录',
    icon: Bookmark,
  },
] as const;

export default function OfflinePage() {
  return (
    <div className="content-container py-14 md:py-20">
      <div className="mx-auto max-w-[42rem]">
        <div className="text-center">
          {/* 圆形底用 `gongke-accent/10` 这类 10 的倍数：Tailwind 的透明度
              修饰符只认默认刻度，写成 `/8` 之类的值不产出任何 CSS，
              那块底会静默消失（见 CLAUDE.md 的坑表）。 */}
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gongke-accent/10 text-gongke-accent">
            <WifiOff className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            离线
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            当前处于离线状态
          </h1>
          <p className="mx-auto mt-4 max-w-[54ch] text-balance text-[15px] leading-relaxed text-gongke-muted">
            网络连接已断开，这一页没法从服务器取到内容。检查一下 Wi-Fi 或移动数据，
            恢复网络后刷新就能接着看。
          </p>
        </div>

        <ul className="mt-10 space-y-2.5">
          {LINKS.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link prefetch={false}
                href={href}
                className="group flex items-center gap-3.5 rounded-xl border border-foreground/10 bg-card px-4 py-3.5 transition-all duration-200 hover:-translate-y-px hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gongke-accent/10 text-gongke-accent">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {/* `min-w-0` 逐层给：flex 子项的 `min-width` 默认是 `auto`，
                    没有它，长提示文案会把整行推出屏幕（手机上表现为右侧被裁）。 */}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                    {hint}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 border-t border-foreground/10 pt-6 text-center text-[13px] leading-relaxed text-muted-foreground">
          看过的样式、字体与缩略图已经缓存在这台设备上，所以这一页通常仍是站内的样子；
          如果它看起来没有排版，说明样式还没被缓存，联网后刷新一次即可。
          收藏列表只存在浏览器里，断网也能打开。
        </p>
      </div>
    </div>
  );
}
