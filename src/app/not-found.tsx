import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, Home, Search } from 'lucide-react';
import { NotFoundArt } from '@/components/not-found-art';
import { navCategories } from '@/lib/nav';

/**
 * 404 —— 2026-10-18 重做。
 *
 * 原先只有一个「返回首页」按钮（原站的样子）。对一个导航站来说这是最差的
 * 死胡同：用户点错一个链接，唯一的出路是回首页从头再来，而这里明明有
 * 2081 个工具、26 个分类和搜索面板可用（work/analysis-ia.md §8）。
 *
 * 现在给三条出路，按「用户最可能想去哪」排序：
 *   1. 搜索（跳到 /tools，那里有全量搜索框；比在 404 页内嵌一个弹窗更容易
 *      被理解，也不会和页眉的 Ctrl+K 抢焦点）；
 *   2. 前 6 个分类；
 *   3. 回首页。
 *
 * 标题也修了：原先 `out/404.html` 的 `<title>` 是首页标题
 * （「试界导航 - 探索发现热门的智能体和AI工具」），因为 not-found 不参与
 * metadata 继承。这里显式导出 metadata，让标签页与分享卡片都能看出这是 404。
 */
export const metadata: Metadata = {
  title: '页面未找到',
  description: '这个地址在试界导航上不存在。可以从搜索、分类或首页继续。',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  const topCategories = navCategories.slice(0, 6);

  return (
    <div className="content-container flex min-h-[calc(100vh-320px)] flex-col items-center justify-center py-16">
      <NotFoundArt />
      {/* 2026-10-27：h1 从 `text-2xl font-medium`（24px/500）改回全站阶梯。
          它是全站唯一一个不在 30/36/40/56 + 650 阶梯上的页面主标题 —— 其余
          15 条路由的 h1 都走 `page-header.tsx` 的 `text-3xl sm:text-4xl
          4xl:text-6xl`（30/36/48，650 由 `font-display` 与 `h1{650}` 给）。
          24px/500 让 404 看起来像另一个站的页面，也让人误以为这是条说明
          而不是「页面不存在」。这里复用 `page-header.tsx` 的同一串 class，
          唯一差别是不带 `tracking-tight`（中文四字 + 数字，收紧后「404」
          与「页面未找到」会粘在一起）。 */}
      <h1 className="mt-2 font-display text-3xl leading-tight text-foreground sm:text-4xl 4xl:text-6xl">
        404 - 页面未找到
      </h1>
      <p className="mt-2 max-w-md text-balance text-center text-sm leading-relaxed text-gongke-muted">
        这个地址不存在，可能已过期或下架。试试下面的入口。
      </p>

      {/* 2026-10-27：按钮从 `rounded-md`(6px) 改成 `rounded-full`。
          6px 那版是从原站复刻来的，但全站的实心主行动（hero 的「浏览全部工具」、
          `/about` 底部、决策条的「帮我选」）一律是胶囊 —— 404 曾是全站唯一
          用 6px 直角墨色按钮的地方，看起来像另一个组件库。 */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link prefetch={false}
          href="/tools"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-gongke-dark px-5 text-sm font-medium text-gongke-paper transition-colors hover:bg-gongke-darkHover"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          搜索全部工具
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <Link prefetch={false}
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/15 px-5 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          返回首页
        </Link>
      </div>

      <div className="mt-10 w-full max-w-2xl">
        <p className="mb-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          或者从这些分类开始
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {topCategories.map((c) => (
            <Link prefetch={false}
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
          <Link prefetch={false}
            href="/categories"
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/20 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            全部 {navCategories.length} 个分类
          </Link>
        </div>
      </div>
    </div>
  );
}
