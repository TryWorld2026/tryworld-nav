'use client';

import { AlertCircle, ArrowRight, BookmarkPlus, Check, Copy, Link2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATALOG_BY_SLUG, DATA_EPOCH } from '@/lib/catalog-index';
import { cardFromRecord } from '@/lib/card';
import { mergeFavorites, readStore, STORAGE_KEY, writeStore, type FavoriteItem } from '@/lib/favorites';
import { updatedMonth } from '@/lib/decide';
import {
  buildStackCompareRows,
  buildStackMarkdown,
  toStackTool,
  type StackTool,
} from '@/lib/stack-export';
import { StackCompareTable } from './stack-compare-table';
import { buildShareUrl, decodeStackParam, STACK_PARAM } from '@/lib/stack-share';
import { VERDICTS_BY_SLUG } from '@/lib/verdict-index';
import { PRICE_LABELS } from '@/lib/search';
import { SITE } from '@/lib/site';
import { rgb } from '@/lib/utils';

/**
 * `/stack?ids=…` —— 别人发来的一份工具栈。
 *
 * 为什么这个页面存在：收藏是**本机**的，链接是**可以发出去的** —— 这两件事
 * 之间原先没有桥。用户想「把我选的这 8 个发给同事」，只能截图或者导出文件。
 * 这里的做法是：链接里只带 slug 列表，页面用目录索引与人工判断**现场还原**
 * 同一份清单（结构、价格、平台、编辑写的适合/不适合都在），再给收件人一个
 * 「保存到我的收藏」—— 分享于是成了**入口**，而不只是导出。
 *
 * 三条必须写进文案的事实（不写就是骗人）：
 *   1. 链接里是**快照**，不是分享者的实时收藏（对方增删不会同步）；
 *   2. 不含任何个人信息 —— 只有公开的 slug，连分享者是谁都不知道；
 *   3. 链接里的工具如果已从目录下架，会明确列出「N 个已不在目录里」，
 *      不会静默少几张卡让人以为是 bug。
 */
export function SharedStack() {
  const [ready, setReady] = useState(false);
  const [slugState, setSlugState] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  /**
   * 合并结果摘要（null = 还没点过）。
   *
   * 只报「新增 N 个」是不够的：分享栈真正的用法是**两个人的栈合并**，
   * 读者最想知道的是「哪些我早就有、哪些我这边还有而对方没有」——
   * 后者正是他把自己的栈反发回去的理由。
   */
  const [merged, setMerged] = useState<{
    added: number;
    already: number;
    /** 我原有的、但对方清单里没有的条数。 */
    onlyMine: number;
    /** 我自己那一份的可分享链接（把差异反发回去）。 */
    myShareHref: string;
  } | null>(null);
  /** 已经收藏过的 slug（决定按钮文案：保存 / 已在你的收藏里）。 */
  const [owned, setOwned] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSlugState(decodeStackParam(params.get(STACK_PARAM)));
    setReady(true);
    try {
      setOwned(new Set(readStore().items.map((it) => it.slug)));
    } catch {
      setOwned(new Set());
    }
    // 另一个标签页里改了收藏，回来时按钮状态要跟上。
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        setOwned(new Set(readStore().items.map((it) => it.slug)));
      } catch {
        /* 隐私模式读不到就算了 */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const rows = useMemo(
    () =>
      slugState.map((slug) => {
        const rec = CATALOG_BY_SLUG.get(slug);
        const v = VERDICTS_BY_SLUG[slug];
        if (!rec) return { slug, missing: true as const };
        const card = cardFromRecord(rec);
        const cat = card.categories[0];
        const priceLabel =
          card.price && card.price !== 'unrated' ? PRICE_LABELS[card.price] ?? '' : '';
        const stale =
          typeof card.updated === 'number' &&
          typeof DATA_EPOCH === 'number' &&
          DATA_EPOCH - card.updated > 365;
        return {
          slug,
          missing: false as const,
          card,
          cat,
          priceLabel,
          stale,
          verdict: v,
          updated: typeof card.updated === 'number' ? updatedMonth(card.updated) : '',
        };
      }),
    [slugState],
  );

  const found = useMemo(() => rows.filter((r) => !r.missing), [rows]);
  const missing = rows.length - found.length;
  /** 2–4 个工具时用对比表替代卡片清单（见下方渲染处的注释）。 */
  const hasCompare = found.length >= 2 && found.length <= 4;

  const importAll = useCallback(() => {
    const items: FavoriteItem[] = [];
    for (const row of found) {
      if (row.missing) continue;
      items.push({
        slug: row.slug,
        name: row.card.name,
        description: row.card.description,
        icon: row.card.icon,
        category: row.cat
          ? { slug: row.cat.slug, name: row.cat.name, color: row.cat.color }
          : undefined,
      });
    }
    const base = readStore();
    const sharedSlugs = new Set(items.map((it) => it.slug));
    const already = base.items.filter((it) => sharedSlugs.has(it.slug)).length;
    const onlyMine = base.items.filter((it) => !sharedSlugs.has(it.slug)).length;

    const { store, added } = mergeFavorites(base, items);
    if (added > 0) writeStore(store);
    setOwned(new Set(store.items.map((it) => it.slug)));
    setMerged({
      added,
      already,
      onlyMine,
      // 合并后「我这一份」的链接：收件人由此可以把差异反发回去，形成来回。
      myShareHref: buildShareUrl(
        typeof window === 'undefined' ? SITE.url : window.location.origin,
        store.items.map((it) => it.slug),
      ),
    });
  }, [found]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // 静默失败比报错更伤：把地址栏选中让用户手动复制。
      setCopied(false);
    }
  }, []);

  /** 水化后的栈数据：复制 Markdown 与「2–4 个就并排对比」共用同一份。 */
  const stackTools: StackTool[] = useMemo(() =>
    found.map((row) =>
      toStackTool({
        slug: row.slug,
        stored: { name: row.card.name },
        catalog: {
          name: row.card.name,
          description: row.card.description,
          price: row.priceLabel,
          platforms: row.card.platforms ?? [],
          categoryName: row.cat?.name ?? '',
          updated: row.updated ? `${row.updated}更新` : '',
        },
        verdict: row.verdict
          ? {
              bestFor: row.verdict.bestFor,
              notFor: row.verdict.notFor,
              diff: row.verdict.diff,
              freeQuota: row.verdict.verdictPrice?.free,
              fromPrice:
                row.verdict.verdictPrice?.from &&
                row.verdict.verdictPrice.currency &&
                row.verdict.verdictPrice.period
                  ? `${row.verdict.verdictPrice.currency === 'USD' ? '$' : '¥'}${row.verdict.verdictPrice.from} / ${row.verdict.verdictPrice.period}`
                  : undefined,
            }
          : null,
        url: `${SITE.url}/tools/${row.slug}`,
        stale: row.stale,
      }),
    ),
    [found],
  );

  const copyMarkdown = useCallback(async () => {
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    try {
      await navigator.clipboard.writeText(
        buildStackMarkdown(stackTools, { date, siteName: SITE.name }),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [stackTools]);

  if (!ready) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-foreground/10 bg-card" />
        ))}
      </div>
    );
  }

  if (slugState.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 px-6 py-14 text-center">
        <Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground/70">这个链接里没有可识别的工具</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
          分享链接里的工具列表是明文的 slug。链接可能被截断、被改过，或者对方清空了收藏。
          你可以先在决策台选三个，再把它们的链接发出去 —— 只需要三分钟。
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            prefetch={false}
            href="/decide"
            className="inline-flex h-10 items-center rounded-md bg-gongke-accent px-4 text-sm font-medium text-white transition-colors hover:bg-gongke-accent/90"
          >
            去帮我选 3 个
          </Link>
          <Link
            prefetch={false}
            href="/tools"
            className="inline-flex h-10 items-center rounded-md border border-foreground/15 px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25"
          >
            逛逛全部工具
          </Link>
        </div>
      </div>
    );
  }

  const allOwned = found.length > 0 && found.every((r) => !r.missing && owned.has(r.slug));

  return (
    <div className="space-y-5">
      {/* ── 摘要 + 动作 ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground/85" aria-live="polite">
            这份工具栈有 <span className="font-semibold text-foreground">{found.length}</span> 个工具
            {missing > 0 ? (
              <span className="text-muted-foreground">（另有 {missing} 个已不在目录里）</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            链接里只有工具名，没有分享者的个人信息，也不含他的实时收藏 —— 增删不会同步。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={importAll}
            disabled={allOwned}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-gongke-accent px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-gongke-accent/90 disabled:cursor-default disabled:bg-foreground/10 disabled:text-foreground/50"
          >
            {allOwned ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {allOwned ? '都在你的收藏里了' : `保存这 ${found.length} 个到我的收藏`}
          </button>
          <button
            type="button"
            onClick={copyMarkdown}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 text-[12.5px] font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            复制 Markdown
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 text-[12.5px] font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
            ) : (
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? '已复制' : '复制这个链接'}
          </button>
        </div>
      </div>

      {merged ? (
        <div
          role="status"
          className="rounded-xl border border-gongke-accent/25 bg-gongke-accent/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-foreground/80"
        >
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Check className="h-3.5 w-3.5 shrink-0 text-gongke-accent" aria-hidden="true" />
            <span>
              合并完成：新增{' '}
              <strong className="font-semibold text-foreground">{merged.added}</strong> 个
              {merged.already > 0 ? (
                <>
                  ，其中 <strong className="font-semibold text-foreground">{merged.already}</strong> 个你早就有了
                </>
              ) : null}
              。
            </span>
          </p>
          {merged.onlyMine > 0 ? (
            <p className="mt-1 text-muted-foreground">
              你的栈里还有{' '}
              <strong className="font-semibold text-foreground">{merged.onlyMine}</strong> 个工具不在这份分享清单里
              —— 可以把你自己那份发回去。
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              prefetch={false}
              href="/favorites"
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-gongke-accent px-3 text-[12px] font-medium text-white transition-colors hover:bg-gongke-accent/90"
            >
              去我的工具栈看看
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
            {merged.onlyMine > 0 ? (
              <a
                href={merged.myShareHref}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-foreground/15 px-3 text-[12px] font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
              >
                <Link2 className="h-3 w-3" aria-hidden="true" />
                看看我这份的链接
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 2–4 个时，先给一张并排对比表再列卡：分享「这两个该选哪个」的人，
          想让对方第一眼看到的就是差别，而不是两张需要自己来回看的卡。
          超过 4 个就不摆表（列太窄读不了），回到卡片清单。 */}
      {hasCompare ? (
        <section aria-labelledby="stack-share-compare" className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2
              id="stack-share-compare"
              className="font-display text-[17px] font-semibold text-foreground"
            >
              并排对比
            </h2>
            <p className="text-[12px] text-muted-foreground">
              九行固定顺序，只摆事实与判断原文，不替你下结论
            </p>
          </div>
          <StackCompareTable
            tools={found.map((r) => ({ slug: r.slug, name: r.card.name }))}
            rows={buildStackCompareRows(stackTools)}
          />
        </section>
      ) : null}

      {/* ── 清单 ─────────────────────────────────────────────────
          2–4 个时上面已经有对比表（九行事实 + 判断），这里再铺一遍卡片就是
          同一份内容说两遍：页面变长、读者还得重新扫一次「适合」。
          所以有表时只留一行紧凑的「去详情页」入口；没有表（1 个或 >4 个）
          才回到卡片清单。 */}
      {hasCompare ? (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
          <li className="text-[12.5px] text-muted-foreground">逐个看详情：</li>
          {found.map((row) => (
            <li key={row.slug}>
              <Link
                prefetch={false}
                href={`/tools/${row.slug}`}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-foreground/15 px-3 text-[12.5px] font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
              >
                {row.card.name}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((row) => {
          if (row.missing) {
            return (
              <li
                key={row.slug}
                className="flex items-start gap-3 rounded-xl border border-dashed border-foreground/15 px-4 py-3.5 text-[13px] text-muted-foreground"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <code className="break-all text-foreground/60">{row.slug}</code>{' '}
                  已不在目录里（可能已下架或被改名）。
                </span>
              </li>
            );
          }
          const isOwned = owned.has(row.slug);
          return (
            <li
              key={row.slug}
              className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03]">
                {row.card.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.card.icon}
                    alt=""
                    width={44}
                    height={44}
                    loading="lazy"
                    decoding="async"
                    className="h-11 w-11 object-contain"
                  />
                ) : (
                  <Sparkles className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  prefetch={false}
                  href={`/tools/${row.slug}`}
                  className="line-clamp-1 text-[15px] font-semibold text-foreground hover:text-gongke-accent"
                >
                  {row.card.name}
                </Link>
                {row.verdict?.bestFor[0] ? (
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                    适合：{row.verdict.bestFor[0]}
                  </p>
                ) : row.card.description ? (
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                    {row.card.description}
                  </p>
                ) : null}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
                  {row.cat ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-1.5 py-0.5 text-foreground/70">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: row.cat.color ? rgb(row.cat.color) : undefined }}
                      />
                      {row.cat.name}
                    </span>
                  ) : null}
                  {row.priceLabel ? <span>{row.priceLabel}</span> : null}
                  {(row.card.platforms ?? []).length > 0 ? (
                    <span>{(row.card.platforms ?? []).slice(0, 3).join(' · ')}</span>
                  ) : null}
                  {row.stale ? (
                    <span className="inline-flex items-center gap-0.5 text-foreground/60">
                      <AlertCircle className="h-3 w-3" aria-hidden="true" />
                      收录已超一年
                    </span>
                  ) : null}
                  {isOwned ? <span className="text-muted-foreground">已在你的收藏里</span> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      )}

      {/* ── 收尾 ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          这份清单由收件人的浏览器在本地还原：工具事实来自目录，适合/不适合来自编辑判断。
          收藏保存在各自设备上，不上传。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            prefetch={false}
            href="/favorites"
            className="inline-flex min-h-9 items-center rounded-full border border-foreground/15 px-3.5 text-[12.5px] font-medium text-foreground/80 transition-colors hover:border-foreground/25"
          >
            我的工具栈
          </Link>
          <Link
            prefetch={false}
            href="/decide"
            className="inline-flex min-h-9 items-center rounded-full bg-gongke-accent px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-gongke-accent/90"
          >
            我也去选 3 个
          </Link>
        </div>
      </div>
    </div>
  );
}
