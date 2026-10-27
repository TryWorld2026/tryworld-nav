'use client';

import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  Download,
  Link2,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  favoritesChangedEvent,
  readStore,
  writeStore,
  STORAGE_KEY,
  toggleFavorite,
  type FavoriteItem,
  type FavoriteStore,
} from '@/lib/favorites';
import { CATALOG_BY_SLUG, DATA_EPOCH } from '@/lib/catalog-index';
import { VERDICTS_BY_SLUG } from '@/lib/verdict-index';
import { PRICE_LABELS } from '@/lib/search';
import { navCategories } from '@/lib/nav';
import { buildShareUrl } from '@/lib/stack-share';
import { updatedMonth } from '@/lib/decide';
import { SITE } from '@/lib/site';
import {
  buildStackCompareRows,
  buildStackMarkdown,
  buildStackPlainText,
  countStale,
  stackFileName,
  toStackTool,
  type StackTool,
} from '@/lib/stack-export';
import { StackCompareTable } from './stack-compare-table';
import { formatDate } from '@/lib/news';
import { rgb } from '@/lib/utils';

/**
 * `/favorites` 的列表本体 —— 2026-10-23 从「收藏列表」升级成「我的工具栈」。
 *
 * 为什么必须升级：收藏一个工具之后，这一页原先只把同一张卡片再列一遍 ——
 * 和 `/tools` 没有任何区别，用户没有理由回来第二次。而「收藏」这件事本身
 * 就是**候选清单**，它天然要回答三个 /tools 回答不了的问题：
 *
 *   1. 我选的这几个**到底怎么比**？（并排对比：价格档 / 免费额度 / 起价 /
 *      平台 / 收录更新 / 编辑判断·适合 / 不适合 / 与同类差异）
 *   2. 我是不是**还漏了**同类里更合适的？（同类里编辑写过判断、你还没收的）
 *   3. 我能不能**把它带走**？（复制 Markdown / 下载 .md —— 贴进笔记、发给同事）
 *
 * 三条都只用站内已有的事实与判断原文，不生成任何「推荐指数」。对比表刻意
 * 不给结论：它把差别摆在同一个行序里，让读者自己看出来。
 *
 * 数据来源（全部客户端安全）：收藏快照（本机）+ `catalog-index`（2081 条事实）
 * + `verdict-index`（363 条人工判断）。**不 import `@/lib/data`**。
 *
 * 新鲜度一律以 `DATA_EPOCH`（目录里最新的那一天）为参照点，不读 `Date.now()`：
 * 静态导出下读墙钟会让「N 个已超一年」每天变一次，构建产物就不再确定。
 */
export function FavoritesList() {
  const [store, setStore] = useState<FavoriteStore>({ version: 2, items: [] });
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  /** 被选中参与并排对比的 slug（最多 4 个）。 */
  const [picked, setPicked] = useState<string[]>([]);
  const [copied, setCopied] = useState<'' | 'md' | 'plain' | 'link'>('');
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    setStore(readStore());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    // 同一个 tab 里别的组件改了收藏（详情页的按钮），这里要跟着变。
    window.addEventListener(favoritesChangedEvent, refresh);
    // 另一个标签页改了收藏，浏览器会派发 storage 事件。
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(favoritesChangedEvent, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  /**
   * 收藏快照 + 目录事实 + 编辑判断 → 一条可渲染、可导出的 `StackTool`。
   *
   * 「以目录为准、回退到收藏快照」：收藏快照是点收藏那一刻的拷贝，工具改名
   * 或重写简介后就旧了；而 v1 迁移来的条目只有 slug，名称就是 slug 本身。
   */
  const rows = useMemo(() => {
    return store.items.map((it) => {
      const rec = CATALOG_BY_SLUG.get(it.slug);
      const v = VERDICTS_BY_SLUG[it.slug];
      const catSlug = rec?.c[0];
      const cat = catSlug ? navCategories.find((c) => c.slug === catSlug) : undefined;
      const priceCode = rec?.p;
      const updated = rec?.u;
      const stale =
        typeof updated === 'number' &&
        typeof DATA_EPOCH === 'number' &&
        DATA_EPOCH - updated > 365;

      const stack = toStackTool({
        slug: it.slug,
        stored: { name: it.name, description: it.description, icon: it.icon },
        catalog: rec
          ? {
              name: rec.n,
              description: rec.d,
              price:
                priceCode && priceCode !== 'unrated' ? PRICE_LABELS[priceCode] ?? '' : '',
              platforms: rec.pl,
              categoryName: cat?.name ?? it.category?.name ?? '',
              updated: typeof updated === 'number' ? `${updatedMonth(updated)}更新` : '',
            }
          : // 目录里查不到这个 slug（工具被下架 / 旧收藏）时，**分类仍要显示**：
            // 收藏快照里存着收藏那一刻的分类名，不给它，对比表会对着一个我们
            // 明明有信息的字段写「—」。
            {
              name: '',
              description: '',
              price: '',
              platforms: [],
              categoryName: it.category?.name ?? '',
              updated: '',
            },
        verdict: v
          ? {
              bestFor: v.bestFor,
              notFor: v.notFor,
              diff: v.diff,
              freeQuota: v.verdictPrice?.free,
              fromPrice:
                v.verdictPrice?.from && v.verdictPrice.currency && v.verdictPrice.period
                  ? `${v.verdictPrice.currency === 'USD' ? '$' : '¥'}${v.verdictPrice.from} / ${v.verdictPrice.period}`
                  : undefined,
            }
          : null,
        url: `${SITE.url}/tools/${it.slug}`,
        stale,
      });

      return {
        item: it,
        stack,
        categoryName: cat?.name ?? it.category?.name ?? '',
        categoryColor: cat?.color ?? it.category?.color,
        priceLabel: priceCode && priceCode !== 'unrated' ? PRICE_LABELS[priceCode] ?? '' : '',
        platforms: rec?.pl ?? [],
        stale,
      };
    });
  }, [store.items]);

  /** 默认对比前 3 个（收藏顺序 = 最近收藏在前），省掉「还要再勾一次」的动作。 */
  useEffect(() => {
    setPicked((prev) => {
      const valid = prev.filter((slug) => store.items.some((it) => it.slug === slug));
      if (valid.length >= 2) return valid;
      return store.items.slice(0, 3).map((it) => it.slug);
    });
  }, [store.items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.stack.name.toLowerCase().includes(q) ||
        (r.stack.category || '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const remove = useCallback((item: FavoriteItem) => {
    // toggleFavorite 对「已存在」的条目就是移除，正好是这里要的语义。
    // 走 writeStore 而不是直接写 storage：它负责广播，列表与详情页按钮同步。
    const next = toggleFavorite(readStore(), item);
    writeStore(next.store);
  }, []);

  const togglePick = useCallback((slug: string) => {
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 4) return [...prev.slice(1), slug];
      return [...prev, slug];
    });
  }, []);

  const staleCount = useMemo(() => countStale(rows.map((r) => r.stack)), [rows]);

  /** 同类里编辑写过判断、但不在栈里的工具（每个分类最多 2 个）。 */
  const suggestions = useMemo(() => {
    const own = new Set(store.items.map((it) => it.slug));
    const cats = new Set<string>();
    for (const r of rows) {
      const rec = CATALOG_BY_SLUG.get(r.item.slug);
      for (const c of rec?.c ?? []) cats.add(c);
    }
    const out: { slug: string; name: string; category: string; reason: string }[] = [];
    for (const cat of cats) {
      const name = navCategories.find((c) => c.slug === cat)?.name ?? cat;
      const candidates = Object.entries(VERDICTS_BY_SLUG)
        .filter(([slug, v]) => !own.has(slug) && v.cats.includes(cat))
        .sort((a, b) => a[1].order - b[1].order)
        .slice(0, 2);
      for (const [slug, v] of candidates) {
        out.push({ slug, name: v.name, category: name, reason: v.bestFor[0] ?? '' });
      }
      if (out.length >= 6) break;
    }
    return out.slice(0, 6);
  }, [rows, store.items]);

  const exportDate = useMemo(() => {
    // `en-CA` 的日期格式恰好是 `YYYY-MM-DD`；时区固定北京时间，与全站一致。
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  }, []);

  const stackForExport: StackTool[] = rows.map((r) => r.stack);

  const copy = useCallback(
    async (kind: 'md' | 'plain') => {
      const text =
        kind === 'md'
          ? buildStackMarkdown(stackForExport, { date: exportDate, siteName: SITE.name })
          : buildStackPlainText(stackForExport, { date: exportDate, siteName: SITE.name });
      try {
        await navigator.clipboard.writeText(text);
        setCopied(kind);
        setFailed(false);
        window.setTimeout(() => setCopied(''), 2200);
      } catch {
        // 剪贴板权限被拒（非 https、或浏览器策略）时**必须给反馈** ——
        // 静默失败会让用户以为按钮坏了（这个站已经踩过一次这个坑）。
        setFailed(true);
        setCopied('');
      }
    },
    [stackForExport, exportDate],
  );

  const download = useCallback(() => {
    const text = buildStackMarkdown(stackForExport, { date: exportDate, siteName: SITE.name });
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = stackFileName(exportDate);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 立刻撤销会让部分浏览器取消下载，延后一拍。
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [stackForExport, exportDate]);

  /**
   * 分享这一份栈 —— 复制 `/stack?ids=…`。
   *
   * 为什么是复制链接而不是「生成短链」：没有服务端。链接里的 slug 列表就是
   * 全部内容，收件人打开时由浏览器用目录索引现场还原（见 `lib/stack-share.ts`）。
   * 用 `window.location.origin` 拼绝对地址，本地预览/预览域名/正式域名都正确。
   */
  const share = useCallback(async () => {
    const url = buildShareUrl(
      window.location.origin,
      store.items.map((it) => it.slug),
    );
    try {
      await navigator.clipboard.writeText(url);
      setCopied('link');
      setFailed(false);
      window.setTimeout(() => setCopied(''), 2400);
    } catch {
      setFailed(true);
      setCopied('');
    }
  }, [store.items]);

  if (!ready) {
    // 骨架：避免「先闪一下空态再出现列表」。
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-foreground/10 bg-card" />
        ))}
      </div>
    );
  }

  if (store.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 px-6 py-16 text-center">
        <Bookmark className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground/70">还没有收藏任何工具</p>
        <p className="mx-auto mt-1 max-w-[44ch] text-xs leading-relaxed text-muted-foreground">
          在工具详情页点「添加收藏」，它们就会出现在这里 —— 可以并排对比、可以导出成
          Markdown 带走。收藏保存在这台设备上，不需要登录。
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link prefetch={false}
            href="/decide"
            className="inline-flex h-10 items-center rounded-md bg-gongke-accent px-4 text-sm font-medium text-white transition-colors hover:bg-gongke-accent/90"
          >
            先帮我选 3 个
          </Link>
          <Link prefetch={false}
            href="/tools"
            className="inline-flex h-10 items-center rounded-md border border-foreground/15 px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25"
          >
            去逛逛全部工具
          </Link>
        </div>
      </div>
    );
  }

  const compareTools = picked
    .map((s) => rows.find((r) => r.item.slug === s))
    .filter(Boolean) as typeof rows;
  const compareRows =
    compareTools.length >= 2 ? buildStackCompareRows(compareTools.map((t) => t.stack)) : [];

  return (
    <div className="space-y-5">
      {/* ── 工具条 ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            共 <span className="font-medium text-foreground">{store.items.length}</span> 个收藏
          </p>
          {staleCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2 py-0.5 text-2xs text-muted-foreground"
              title="收录快照超过一年，功能与价格可能已经变化"
            >
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {staleCount} 个的收录更新已超一年
            </span>
          ) : null}
        </div>
        <div className="relative w-full sm:w-56">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="在工具栈里搜索…"
            aria-label="在工具栈里搜索"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
          />
        </div>
      </div>

      {/* ── 导出 ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5">
        <span className="mr-auto text-xs text-muted-foreground">
          带走整份清单（{store.items.length} 个，按分类分组，含判断摘要）
        </span>
        <button
          type="button"
          onClick={() => copy('md')}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          {copied === 'md' ? (
            <Check className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied === 'md' ? '已复制 Markdown' : '复制 Markdown'}
        </button>
        <button
          type="button"
          onClick={download}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          下载 .md
        </button>
        <button
          type="button"
          onClick={share}
          title="复制一个链接；对方打开后可以一键收进他自己的收藏"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          {copied === 'link' ? (
            <Check className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
          ) : (
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied === 'link' ? '已复制分享链接' : '分享链接'}
        </button>
        <button
          type="button"
          onClick={() => copy('plain')}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied === 'plain' ? '已复制纯文本' : '复制纯文本'}
        </button>
        {failed ? (
          <span className="text-xs text-destructive" role="status">
            剪贴板不可用，请改用「下载 .md」
          </span>
        ) : null}
      </div>

      {/* ── 并排对比 ───────────────────────────────────────────── */}
      {compareTools.length >= 2 ? (
        <section aria-labelledby="stack-compare" className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="stack-compare" className="font-display text-lg font-semibold text-foreground">
              并排对比
            </h2>
            <p className="text-xs text-muted-foreground">
              勾选 2–4 个工具；这张表只摆事实与判断原文，不替你下结论
            </p>
          </div>
          <StackCompareTable
            tools={compareTools.map((t) => ({ slug: t.item.slug, name: t.stack.name }))}
            rows={compareRows}
          />
        </section>
      ) : null}

      {/* ── 栈列表 ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          工具栈里没有匹配「{query}」的工具。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map(({ item: it, stack, categoryName, categoryColor, priceLabel, platforms, stale }) => {
            // 时间必须走 `Asia/Shanghai` 的格式化函数（`slice(0,10)` 是 UTC 日期，
            // 北京时间 0:00–8:00 之间收藏的会显示成「昨天」）。
            const addedOn = it.addedAt ? formatDate(it.addedAt) : '';
            const on = picked.includes(it.slug);
            return (
              <li
                key={it.slug}
                className={
                  'group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors ' +
                  (on ? 'border-gongke-accent/35' : 'border-foreground/10 hover:border-foreground/20')
                }
              >
                <button
                  type="button"
                  onClick={() => togglePick(it.slug)}
                  aria-pressed={on}
                  aria-label={`${on ? '取消对比' : '加入对比'} ${stack.name}`}
                  className={
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-ring ' +
                    (on
                      ? 'border-gongke-accent bg-gongke-accent text-white'
                      : 'border-foreground/25 text-transparent hover:border-gongke-accent/60')
                  }
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03]">
                  {it.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.icon}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-11 object-contain"
                    />
                  ) : (
                    <Bookmark className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link prefetch={false}
                    href={`/tools/${it.slug}`}
                    className="line-clamp-1 text-base font-semibold text-foreground hover:text-gongke-accent"
                  >
                    {stack.name}
                  </Link>
                  {stack.bestFor[0] ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gongke-muted">
                      适合：{stack.bestFor[0]}
                    </p>
                  ) : it.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gongke-muted">
                      {it.description}
                    </p>
                  ) : null}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
                    {categoryName ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-1.5 py-0.5 text-foreground/70">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: categoryColor ? rgb(categoryColor) : undefined }}
                        />
                        {categoryName}
                      </span>
                    ) : null}
                    {priceLabel ? <span>{priceLabel}</span> : null}
                    {platforms.length > 0 ? <span>{platforms.slice(0, 3).join(' · ')}</span> : null}
                    {stale ? (
                      <span className="inline-flex items-center gap-0.5 text-foreground/60">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        收录已超一年
                      </span>
                    ) : null}
                    {addedOn ? <span className="tabular-nums">收藏于 {addedOn}</span> : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => remove(it)}
                  aria-label={`取消收藏 ${stack.name}`}
                  className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── 同类补充 ───────────────────────────────────────────── */}
      {suggestions.length > 0 ? (
        <section aria-labelledby="stack-more" className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 md:p-5">
          <h2 id="stack-more" className="text-sm font-semibold text-foreground">
            同类里编辑写过判断、你还没收的
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            按目录排位取每个分类的前两个 —— 「排位」只是 tools.json 的原始顺序，不是评分。
          </p>
          <ul className="mt-2.5 divide-y divide-foreground/[0.07]">
            {suggestions.map((s) => (
              <li key={s.slug} className="flex min-w-0 items-start gap-2 py-2 first:pt-0">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/30" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-xs leading-relaxed">
                  <Link
                    prefetch={false}
                    href={`/tools/${s.slug}`}
                    className="font-medium text-foreground hover:text-gongke-accent"
                  >
                    {s.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {' '}
                    · {s.category}
                    {s.reason ? ` · 适合：${s.reason}` : ''}
                  </span>
                </p>
                <Link
                  prefetch={false}
                  href={`/tools/${s.slug}`}
                  className="shrink-0 text-2xs text-gongke-accent hover:underline"
                >
                  看看
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
        收藏只保存在这台设备的浏览器里，不上传、不需要账号。换设备或清除浏览器数据会丢失。
      </p>
    </div>
  );
}
