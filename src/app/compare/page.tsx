import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { allComparePairs, topComparePairs } from '@/lib/compare-server';
import type { ComparePair } from '@/lib/compare';
import { toolBySlug, SITE } from '@/lib/data';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

/**
 * 对比总览 `/compare`。
 *
 * 这一页解决的是「我知道要选，但不知道拿谁和谁比」。
 *
 * 清单口径见 `lib/compare.ts` 文件头：用**读者关心度**（首页推荐 / 编辑集合
 * 收录 / 两边都有判断 / 同分类门槛），**不用**原站 `related` 的自动推荐
 * —— 那个字段 2080 条全都 6 个、权重一样，按它排出来的前几名全是冷门工具。
 *
 * 「最值得看的几组」用 `pickDistinctPairs()` 挑**互不重叠**的组合：同一个
 * 工具连出现三次（比如 Lovart 同时对比哩布哩布、即梦、堆友），读者会以为
 * 我们只有这一个工具。
 */
export const metadata: Metadata = withOg(
  {
    ...canonical('/compare'),
    title: '二选一对比',
    description:
      'AI 工具的二选一对比：价格、平台、更新时间的事实对照，加上编辑对「适合谁 / 不适合谁」的判断。',
  },
  '/compare',
);

export default function CompareIndexPage() {
  const pairs = allComparePairs();
  const top = topComparePairs(7);
  const topSlugs = new Set(top.map((p) => p.slug));
  const rest = pairs.filter((p) => !topSlugs.has(p.slug));

  return (
    <div className="content-container space-y-8 py-8 md:py-10">
      <PageHeader
        eyebrow="决策辅助"
        title="二选一对比"
        description={`${pairs.length} 组并排对比。每组先给事实差异（价格、平台、更新时间），再给编辑判断 —— 两边都有判断的排在最前。`}
      />

      {top.length > 0 && (
        <section aria-labelledby="top-heading">
          <h2
            id="top-heading"
            className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground"
          >
            <Scale className="h-4 w-4 text-gongke-accent" aria-hidden="true" />
            最值得看的 {top.length} 组
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {top.map((p) => (
              <PairCard key={p.slug} pair={p} emphasis />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="rest-heading">
          <h2 id="rest-heading" className="mb-3 text-[15px] font-semibold text-foreground">
            其他对比
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <PairCard key={p.slug} pair={p} />
            ))}
          </div>
        </section>
      )}

      <p className="border-t border-foreground/10 pt-5 text-[12.5px] leading-relaxed text-muted-foreground">
        这份清单不是手挑的：它按「读者关心度」从目录数据算出来 —— 首页常用推荐、
        被编辑集合收录、以及两边都写过判断的工具排在前，并且只取**同分类**的组合
        （跨分类的二选一对读者没有意义）。想让我们补上某一对，可在
        <Link prefetch={false} href="/about" className="mx-1 text-gongke-accent underline underline-offset-2 hover:text-gongke-accent/80">
          关于我们
        </Link>
        页找到反馈方式。
      </p>
    </div>
  );
}

/** 一组对比的入口卡：两个工具名 + 图标 + 「vs」。 */
function PairCard({
  pair,
  emphasis = false,
}: {
  pair: ComparePair;
  emphasis?: boolean;
}) {
  const a = toolBySlug.get(pair.a);
  const b = toolBySlug.get(pair.b);
  if (!a || !b) return null;

  return (
    <Link prefetch={false}
      href={`/compare/${pair.slug}`}
      className={`group flex items-center gap-3 rounded-xl border border-foreground/10 bg-card px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md hover:shadow-foreground/[0.04] active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        emphasis ? 'sm:py-4' : ''
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {a.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.icon}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            decoding="async"
            className="h-7 w-7 shrink-0 rounded-md object-contain"
          />
        )}
        <span className="min-w-0 truncate text-[14px] font-medium text-foreground transition-colors group-hover:text-gongke-accent">
          {a.name}
        </span>
      </span>
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        vs
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="min-w-0 truncate text-right text-[14px] font-medium text-foreground transition-colors group-hover:text-gongke-accent">
          {b.name}
        </span>
        {b.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.icon}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            decoding="async"
            className="h-7 w-7 shrink-0 rounded-md object-contain"
          />
        )}
      </span>
      <ArrowRight
        className="ml-1 h-3.5 w-3.5 shrink-0 text-foreground/25 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-gongke-accent"
        aria-hidden="true"
      />
    </Link>
  );
}
