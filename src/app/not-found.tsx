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
      <h1 className="mt-2 text-2xl font-medium font-display text-foreground">404 - 页面未找到</h1>
      <p className="mt-2 max-w-md text-balance text-center text-sm leading-relaxed text-gongke-muted">
        这个地址不存在，可能已过期或下架。试试下面的入口。
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link prefetch={false}
          href="/tools"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-gongke-dark px-4 text-sm font-medium text-[#F2EEE6] transition-colors hover:bg-[#253230]"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          搜索全部工具
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <Link prefetch={false}
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-foreground/15 px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
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
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-[13px] text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
          <Link prefetch={false}
            href="/categories"
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/20 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            全部 {navCategories.length} 个分类
          </Link>
        </div>
      </div>
    </div>
  );
}
