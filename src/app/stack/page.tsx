import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Link2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { SharedStack } from '@/components/shared-stack';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

/**
 * 分享出来的工具栈（`/stack?ids=a,b,c`）。
 *
 * 与 `/favorites` 的分工：
 *   - `/favorites` 是**我的**：读本机 localStorage，可增可删可对比；
 *   - `/stack` 是**别人的**：只读，内容全在 URL 里，收件人可以一键收进自己的栈。
 *
 * 为什么 SEO 上必须 `noindex`：这个页面的内容是查询参数决定的，`/stack` 本身
 * 永远是空的。收录它只会让搜索引擎抓到一个空壳页（`/favorites` 同理）。
 * 也不进 sitemap。
 */
export const metadata: Metadata = withOg(
  {
    ...canonical('/stack'),
    title: '别人分享的 AI 工具栈',
    description:
      '打开一个分享链接，看对方选的 AI 工具、编辑写的适合与不适合，并一键收进自己的工具栈。',
    robots: { index: false, follow: false },
  },
  '/stack',
);

export default function SharedStackPage() {
  return (
    <div className="content-container py-8 md:py-10">
      <PageHeader
        eyebrow="分享 · 只读"
        title="一个分享出来的 AI 工具栈"
        description="链接里只有工具名，没有分享者的任何个人信息。工具事实来自目录索引，适合与不适合来自编辑判断 —— 收件人的浏览器在本地还原同一份清单，随时可以一键收进自己的收藏。"
      >
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            prefetch={false}
            href="/favorites"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-foreground/15 px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            我的工具栈
          </Link>
          <Link
            prefetch={false}
            href="/decide"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-foreground/15 px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            自己选 3 个
          </Link>
        </div>
      </PageHeader>

      <div className="mt-6 max-w-4xl">
        <SharedStack />
      </div>
    </div>
  );
}
