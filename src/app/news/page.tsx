import type { Metadata } from 'next';
import { Calendar, Clock, ExternalLink } from 'lucide-react';
import { newsItems } from '@/lib/data';
import { formatDate, formatDateShort, relativeLabel } from '@/lib/news';
import { canonical } from '@/lib/canonical';

export const metadata: Metadata = {
  ...canonical('/news'),
  title: 'AI 资讯',
  description:
    '聚合 AIHOT 精选的 AI 行业资讯：模型发布、产品更新、行业动态、论文与观点，点击标题阅读原文。',
};

/**
 * /news —— AIHOT 精选资讯卡片流。
 *
 * 这里在 2026-10-15 之前是原站十篇长文的复刻（`md/lg/xl` 网格 + `next/image`
 * 封面 + 站内详情页）。现在换成资讯卡片流，三个原因：
 *
 *   1. AIHOT 只提供摘要，不提供正文，站内详情页没有内容可渲染；
 *   2. AIHOT 不提供配图，`next/image` 的封面位没有来源；
 *   3. 卡片直接跳原文，读者一步到源头，也满足 AIHOT 规则里「保留原文链接与
 *      canonical」的要求。
 *
 * 署名是硬要求而非装饰：AIHOT《公开使用规则》v1.1 第 5、6 条禁止删除或伪造
 * 机器响应中的来源与 canonical 信息。所以每张卡片都展示 `source`（来源站名），
 * 并在页脚给出指向 AIHOT 的出处说明。
 *
 * 布局：单列列表而不是网格。摘要长度不一，网格里高度参差；列表让标题、摘要、
 * 元信息三行对齐，扫读更快，也更接近「资讯流」的形态。
 */
export default function NewsIndexPage() {
  return (
    <>
      <div className="bg-background pt-8 px-2">
        <div className="px-2 sm:px-8">
          <div className="max-w-4xl">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 font-display">AI 资讯</h1>
            <p className="text-gongke-muted text-lg mb-8">
              AIHOT 精选的 AI 行业动态、模型与产品发布、论文和观点。点击标题阅读原文。
            </p>
          </div>
        </div>
      </div>

      <div className="pt-2 pb-8 px-4 md:px-8 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {newsItems.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">
              暂时没有资讯。数据由构建前的 <code>scripts/fetch-aihot.mjs</code> 抓取。
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {newsItems.map((item) => {
                const relative = relativeLabel(item.publishedAt);
                return (
                  <li key={item.id} className="py-5 first:pt-0">
                    <article className="group">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-light text-secondary-foreground">
                          {item.categoryLabel}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time>
                          {relative && <span className="text-muted-foreground/70">· {relative}</span>}
                        </div>
                      </div>

                      {/* 标题即外链：整条资讯的跳转目标就是原文。`target=_blank`
                          配 `rel=noopener`（新窗口无法回控本页）。 */}
                      <h2 className="text-lg font-semibold tracking-tight mb-2">
                        <a
                          href={item.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors inline-flex items-start gap-1.5"
                        >
                          <span>{item.title}</span>
                          <ExternalLink
                            className="w-3.5 h-3.5 mt-1.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-hidden="true"
                          />
                        </a>
                      </h2>

                      {item.summary && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{item.summary}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>
                          来源：<span className="text-foreground/70">{item.source}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <time dateTime={item.publishedAt ?? undefined}>{formatDateShort(item.publishedAt)}</time>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 出处说明。规则第 6 条：取得授权的对外产品须展示来源；本站按非商业
              用途使用，不强制署名，但保留出处是对上游的基本尊重，也让读者能追溯。 */}
          <p className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground">
            资讯精选与中文摘要来自{' '}
            <a
              href="https://aihot.news"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              AIHOT
            </a>
            ，版权归各来源与原作者所有；本站仅作聚合展示，点击标题可阅读原文。
          </p>
        </div>
      </div>
    </>
  );
}
