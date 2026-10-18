import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Simple long-form page shell used by the static content routes.
 *
 * 2026-10-17 重做。原来外层只有一个 `max-w-3xl`：页头贴在内容列最左缘
 * （1920 下 h1 左缘 192px，比其它页的 448px 靠左 256px），而正文段落又只有
 * 768px 宽，整页在宽屏上是一块偏左的窄条，右侧 900px 全空。
 *
 * 现在：
 *   - 走 `.content-container`，与其他页面同一条左基线；
 *   - 正文列 720px（`max-w-[45rem]`，约 40 个中文字符/行），并**居中**在容器里；
 *   - 页面底部给一个返回首页的出口 —— 长文页最难受的是读完不知道去哪。
 */
export function ProsePage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="content-container py-10 md:py-12">
      <div className="mx-auto max-w-[45rem]">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回首页
        </Link>

        <article>
          <header className="border-b border-foreground/10 pb-6">
            <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {intro && (
              <p className="mt-3 text-[15px] leading-relaxed text-gongke-muted">{intro}</p>
            )}
          </header>

          {/* `[&_li]:[text-wrap:balance]`：条款列表在 390 下每条正好两行，
              末行常只剩「访问；」这类两个字（实测 9%、13%）。条款一句一条，
              均衡换行不会把一句话拆到两行里读不通，只把短尾挪平。正文段落
              （`<p>`）保持默认——四行以上的白话，均衡反而让行宽显得机械。 */}
          <div className="mt-8 space-y-5 text-[15px] leading-[1.85] text-foreground/75 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-0.5 [&_li]:marker:text-gongke-accent/50 [&_li]:[text-wrap:balance] [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>

        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-6">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 rounded-full bg-gongke-accent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-gongke-accent/90 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            浏览全部工具
          </Link>
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-4 py-2 text-sm font-medium text-foreground/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:text-foreground hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
          >
            看 AI 资讯
          </Link>
        </div>
      </div>
    </div>
  );
}
