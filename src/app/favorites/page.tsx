import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { FavoritesList } from '@/components/favorites-list';
import { PageHeader } from '@/components/page-header';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

/**
 * 我的收藏 —— 纯本机，无账号。
 *
 * 为什么这个页面必须存在：详情页的「添加收藏」从 2026-10 起就往 localStorage
 * 里写数据，但全站没有任何入口能把它读出来 —— 收藏按钮等于写进黑洞
 * （work/analysis-ia.md §9⑤）。同时页眉右上那个「登录/注册」点开写着
 * 「复刻版本未包含账号系统」，是首屏最伤信任的一处。一个 `/favorites` 同时
 * 解决这两个问题：给数据一个出口，给那个按钮一个诚实的去处。
 *
 * SEO：`robots: { index: false }`。这是每个用户各不相同的本机数据，收录它
 * 只会让搜索引擎抓到一个永远为空的页面；也不进 sitemap（见 `sitemap.ts`）。
 */
export const metadata: Metadata = withOg(
  {
  ...canonical('/favorites'),
  title: '我的收藏',
  description: '你在试界导航收藏的 AI 工具，保存在本机浏览器里，不需要账号。',
  robots: { index: false, follow: false },
  },
  '/favorites',
);

export default function FavoritesPage() {
  return (
    <div className="content-container py-8 md:py-10">
      <PageHeader
        eyebrow="本机收藏"
        title="我的收藏"
        description="收藏保存在这台设备的浏览器里，不上传、不需要登录。换设备或清除浏览器数据会丢失。"
      >
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3.5 py-2 text-[13px] font-medium text-foreground/80 transition-all hover:-translate-y-px hover:border-foreground/25 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            返回全部工具
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
            在工具详情页点「添加收藏」即可加入
          </span>
        </div>
      </PageHeader>

      <div className="mt-7">
        <FavoritesList />
      </div>
    </div>
  );
}
