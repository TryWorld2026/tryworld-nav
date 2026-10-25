import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Scale } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { allComparePairs, topComparePairs } from '@/lib/compare-server';
import type { ComparePair } from '@/lib/compare';
import { categories, toolBySlug, SITE } from '@/lib/data';
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
  const groups = groupByCategory(rest);

  return (
    <div className="content-container space-y-8 py-8 md:py-10">
      <PageHeader
        eyebrow="决策辅助"
        title="二选一对比"
        description={`${pairs.length} 组并排对比。每组先给事实差异（价格、平台、更新时间），再给编辑判断 —— 两边都有判断的排在最前，其余按分类折叠。`}
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

      {/* 其余按分类折叠。
          原先 294 张卡片平铺：手机 390×844 实测页高 **20553px（约 24 屏）**，
          桌面也要滚 7300px —— 而这一页的职责是「找到该比的那一对」，不是
          「滚完所有对」。折叠后首屏只剩 26 个分类摘要，点开才是清单。
          链接仍在 DOM 里（`<details>` 收起不影响抓取），294 个对比页的
          内链可达性没有损失。 */}
      {groups.length > 0 && (
        <section aria-labelledby="rest-heading" className="space-y-3">
          <h2 id="rest-heading" className="text-[15px] font-semibold text-foreground">
            按分类浏览其余 {rest.length} 组
          </h2>
          {groups.map((g) => (
            <details
              key={g.slug}
              className="group rounded-xl border border-foreground/10 bg-card"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: g.color ? `rgb(${g.color})` : undefined }}
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
                  {g.name}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  {g.pairs.length} 组
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid grid-cols-1 gap-3 border-t border-foreground/[0.07] p-4 md:grid-cols-2 lg:grid-cols-3">
                {g.pairs.map((p) => (
                  <PairCard key={p.slug} pair={p} />
                ))}
              </div>
            </details>
          ))}
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

/**
 * 其余对比按「两边共同的那个分类」分组。
 *
 * `comparePairs()` 已经把跨分类的组合挡掉了（见 `lib/compare.ts`），所以每组
 * 工具理论上都有共同分类；取 `a` 的分类里第一个也出现在 `b` 上的那个即可。
 * 万一取不到（数据被改过），落到「其他」而不是丢掉 —— 294 组必须一个不少，
 * 这一页的底部文案写着「这份清单不是手挑的」，悄悄少几组就是谎。
 *
 * 组的顺序用 `categories` 自己的顺序（与首页、侧栏一致），不按组内数量排，
 * 免得同一页在两个地方给出两套顺序。
 */
function groupByCategory(pairs: ComparePair[]): {
  slug: string;
  name: string;
  color?: string;
  pairs: ComparePair[];
}[] {
  const bucket = new Map<string, ComparePair[]>();
  for (const p of pairs) {
    const ca = toolBySlug.get(p.a)?.categories ?? [];
    const cb = toolBySlug.get(p.b)?.categories ?? [];
    const shared = ca.find((c) => cb.some((x) => x.slug === c.slug));
    const key = shared?.slug ?? '__other__';
    const list = bucket.get(key);
    if (list) list.push(p);
    else bucket.set(key, [p]);
  }

  const groups: { slug: string; name: string; color?: string; pairs: ComparePair[] }[] = [];
  for (const c of categories) {
    const list = bucket.get(c.slug);
    if (list?.length) {
      groups.push({ slug: c.slug, name: c.name, color: c.color, pairs: list });
      bucket.delete(c.slug);
    }
  }
  const rest = bucket.get('__other__');
  if (rest?.length) groups.push({ slug: '__other__', name: '其他', pairs: rest });
  bucket.delete('__other__'); // 不删的话，下面兜底循环会把它再 push 一遍
  // 没被 categories 认出的分类（数据里删过分类但还有对比页）也保留，不静默丢
  for (const [slug, list] of bucket) {
    if (list.length) groups.push({ slug, name: slug, pairs: list });
  }
  return groups;
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
