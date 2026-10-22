'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronDown,
  Clock,
  Flame,
  Newspaper,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Reveal } from './reveal';
import { HeadlineText } from './headline-text';
import {
  NEWS_RANGES,
  categoryList,
  categoryTone,
  dayBucketLabel,
  formatDateShort,
  formatDateTime,
  groupByDay,
  inRange,
  monthList,
  searchNews,
  sourceList,
} from '@/lib/news';
import type { NewsItem } from '@/lib/types';
import type { NewsRange } from '@/lib/news';
// slug → SearchRecord 的 Map 由 `lib/catalog-index.ts` 统一解码一次，
// 资讯卡片的「站内收录」chip 只查表，不再自己强转 v2 wire。
import { CATALOG_BY_SLUG } from '@/lib/catalog-index';
import { asset } from '@/lib/assets';

/**
 * 资讯流 —— `/news` 的主体。
 *
 * 这是**客户端组件**：搜索、分类、时间范围、来源筛选都在浏览器里完成。为什么
 * 不做成静态分组页：
 *
 *   1. 静态导出没有服务端，查询参数只能在客户端读（与 `/tools` 同一套做法，
 *      见 `tools-explorer.tsx`），页面框架仍然预渲染，首屏不是空壳；
 *   2. 资讯只有上百条、每条几 KB，全量下发比每次筛选都请求一次便宜得多；
 *   3. 筛选是「探索」动作，即时响应比 SEO 更重要 —— SEO 由五个频道页承担。
 *
 * 视觉与交互（对齐 aihot.news/daily 的阅读节奏，但保持本站的克制）：
 *
 *   - **按天分组**，组头 sticky，滚动时当前日期始终可见；
 *   - 卡片左侧 2px 分类色条（`categoryTone`），扫读时用颜色分栏；
 *   - `active:scale-[0.98]` + hover 抬升 1px 的按压手感，与站内按钮一致；
 *   - 入场用 `Reveal` 的 IntersectionObserver 淡入，只播一次；
 *   - 筛选状态写进 URL（`?q=&cat=&range=`），刷新/分享/后退都保持。
 *
 * 空状态、无结果、加载更多都给了明确出口，不留死胡同。
 */

const PAGE = 20;

/** 从 URL 读初始筛选。挂载后再读，避免静态 HTML 与服务端不一致。 */
function useUrlState() {
  const [state, setState] = useState<{ q: string; cats: string[]; range: NewsRange }>({
    q: '',
    cats: [],
    range: 'all',
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const range = params.get('range');
    setState({
      q: params.get('q') ?? '',
      cats: (params.get('cat') ?? '').split(',').filter(Boolean),
      range:
        range === 'today' || range === '3d' || range === '7d' || range === 'all'
          ? range
          : 'all',
    });
    setReady(true);
  }, []);

  return { ...state, ready };
}

export function NewsFeed({
  items,
  toolLinks = {},
  buildTime,
}: {
  items: NewsItem[];
  /**
   * `{ [newsId]: toolSlug[] }` —— 构建期算好的「这条资讯里提到的站内工具」。
   * 客户端不再重复匹配（2081 × 124 次子串扫描会拖慢首次渲染），
   * 由 `lib/news-links.ts` 在 server component 里算一次。
   */
  toolLinks?: Record<string, string[]>;
  /**
   * 构建时刻的 ISO 字符串 —— 服务端渲染与客户端**首次水合**共用的「现在」。
   *
   * 为什么必须由外面传进来：`dayBucketLabel` / `inRange` 的默认参数是
   * `new Date()`，服务端求值一次、客户端水合再求值一次。跨过北京时间午夜后
   * 两者给出的分组标签不同（服务端写死「今天」，客户端算出「昨天」），
   * React 于是报 #418 并丢弃整棵服务端 DOM 重渲染 —— 部署后第 2 天起每次
   * 访问都会触发。所以第一次渲染固定用构建时刻（服务端与客户端一致），
   * 挂载完成后再升级成真实当前时间。
   */
  buildTime: string;
}) {
  const initial = useUrlState();
  const [query, setQuery] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [range, setRange] = useState<NewsRange>('all');
  const [source, setSource] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  /**
   * 渲染用的「现在」。
   *
   * 首帧**必须**等于构建时刻，否则服务端 HTML 与客户端水合结果不一致：
   * 服务端在构建那天算出「今天」，客户端在访问那天算成「昨天」，React 报
   * #418 并整棵丢弃重渲染（部署后第 2 天起每次访问 `/news` 都会发生）。
   *
   * 挂载后立刻升级成真实当前时间：相对标签与「今天/近 3 天」这类范围筛选
   * 才对访客的**当下**有意义，而不是对构建那天有意义。
   *
   * 用 string 存而不是 Date：Date 对象每次都是新引用，会让下游 useMemo
   * 失效；ISO 字符串按值比较，稳定。
   */
  const [nowIso, setNowIso] = useState(buildTime);
  useEffect(() => {
    setNowIso(new Date().toISOString());
  }, []);
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  /**
   * 组头的 sticky 位置必须贴着筛选条的**下沿**，而筛选条高度不是常数：
   * 收起时 103px（搜索行 44 + 时间区间行 34 + 上下内边距 24），点开「筛选」
   * 后约 286px，手机上时间区间换行还会再高一点。
   *
   * 之前组头写死 `+ 6.5rem`（104px），只有筛选条恰好 52px 时才对齐；实测
   * 103px 时组头整整滑到筛选条**底下** —— 筛选条 z-20、组头 z-10，日期被
   * 盖住，滚动时完全看不见，这一条「组头 sticky」等于没做。
   *
   * 所以改成实测：ResizeObserver 盯着筛选条，把高度写进根节点的
   * `--news-filter-h`，组头的 `top` 直接引用它。展开/收起、断点变化、
   * 字体回退导致的行高变化都会自动跟上。
   */
  useEffect(() => {
    const el = filterRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    const write = () => root.style.setProperty('--news-filter-h', `${el.offsetHeight}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // URL 里的初始值只灌一次。
  useEffect(() => {
    if (!initial.ready || applied) return;
    setQuery(initial.q);
    setCats(initial.cats);
    setRange(initial.range);
    setApplied(true);
  }, [initial, applied]);

  // 筛选变化时同步回 URL（`replaceState`，不产生历史记录，后退键仍然回上一页）。
  useEffect(() => {
    if (!applied) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (cats.length) params.set('cat', cats.join(','));
    if (range !== 'all') params.set('range', range);
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState(null, '', url);
  }, [query, cats, range, applied]);

  // 任何筛选变化都把分页重置回第一页，否则「加载更多」的展开量会跨筛选残留。
  useEffect(() => {
    setLimit(PAGE);
  }, [query, cats, range, source]);

  // 「/」聚焦搜索框（与站内 CommandDialog 的快捷键错开：那个是 ⌘K / Ctrl+K）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const facets = useMemo(() => categoryList(items), [items]);
  const sources = useMemo(() => sourceList(items, 10), [items]);
  const months = useMemo(() => monthList(items), [items]);

  const filtered = useMemo(() => {
    let list = items.filter((it) => inRange(it, range, now));
    if (cats.length) {
      const set = new Set(cats);
      list = list.filter((it) => (it.category ?? '__none__') && set.has(it.category ?? '__none__'));
    }
    if (source) list = list.filter((it) => it.source === source);
    if (query.trim()) list = searchNews(list, query);
    // 搜索时按相关度（`searchNews` 已排好），否则保持传进来的时间倒序。
    return list;
  }, [items, range, cats, source, query, now]);

  const groups = useMemo(() => groupByDay(filtered, now), [filtered, now]);
  const hasFilter = Boolean(query.trim() || cats.length || range !== 'all' || source);

  /**
   * `toolLinks`（slug 数组）→ 渲染需要的 `{slug,name,icon}`。
   * 这里用 `navCategories` 之外的轻量数据源：`CATALOG_BY_SLUG` 里已有
   * 全部 2081 条的名称与图标（搜索索引 59 KB br），比拖进整个目录便宜。
   * 索引本身在 `lib/catalog-index.ts` 里解码一次，全站共用，这里只查表。
   */
  const linkedToolMap = useMemo(() => {
    const out = new Map<string, { slug: string; name: string; icon: string }[]>();
    if (!toolLinks || Object.keys(toolLinks).length === 0) return out;
    for (const [newsId, slugs] of Object.entries(toolLinks)) {
      const list = slugs.flatMap((s) => {
        const r = CATALOG_BY_SLUG.get(s);
        // 没收录的 slug 直接跳过 —— 资讯里提到的工具站内常常还没有。
        // `r.i` 是索引里的站内相对路径，媒体主机前缀必须在这里补
        // （索引本身不能预拼，理由见 `lib/catalog-index.ts`）。
        return r ? [{ slug: r.s, name: r.n, icon: asset(r.i) }] : [];
      });
      if (list.length) out.set(newsId, list);
    }
    return out;
  }, [toolLinks]);

  // 「加载更多」按条目总数计，而不是按组 —— 组头只在跨组时出现，按组计数会
  // 让「20 条」变成「20 天」。
  const visibleGroups = useMemo(() => {
    let budget = limit;
    const out: typeof groups = [];
    for (const g of groups) {
      if (budget <= 0) break;
      out.push({ ...g, items: g.items.slice(0, budget) });
      budget -= g.items.length;
    }
    return out;
  }, [groups, limit]);

  const visibleCount = visibleGroups.reduce((n, g) => n + g.items.length, 0);

  function reset() {
    setQuery('');
    setCats([]);
    setRange('all');
    setSource('');
  }

  function toggleCat(id: string) {
    setCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  return (
    <div ref={rootRef}>
      {/* ── 筛选条 ─────────────────────────────────────────────── */}
      {/* 满宽条（背景要铺边）+ 内层与正文同宽的容器。之前内层写死
          `max-w-[1180px]`，与新的 1280 容器差 100px，宽屏上筛选条会比下面的
          卡片窄一截。 */}
      <div
        ref={filterRef}
        className="sticky z-20 border-b border-foreground/5 bg-background/90 pb-3 pt-3 backdrop-blur-xl"
        style={{ top: 'calc(var(--site-header-h, 3.5rem) + 3.25rem)' }}
      >
        {/* `content-container`（最宽 1760），与下方卡片网格、频道栏、报头
            同一把尺子。宽度本身不再意味着「一行 100 字」—— 卡片网格在
            ≥1280 拆成两列、≥2100 三列，单卡始终在 570–860px 之间。
            sticky 条的底色只需覆盖内容列本身 —— 页面正文整体就是这一列，
            两侧是纸面底色，不需要铺满视口。 */}
        <div className="content-container">
          {/* 搜索框**不再吃满整行**：1760 的正文里一条 1240px 的圆角输入框
              既不像输入框，也让右侧空出一大块没有去处。封顶 30rem（480px），
              与筛选按钮挨在一起，剩下的宽度交给右对齐的结果计数 —— 工具条
              因此有了左右两端，而不是一条被拉长的空白。 */}
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-[30rem] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题、来源、摘要…"
                aria-label="搜索资讯"
                // `text-base sm:text-sm` 而不是写死 `text-sm`：iOS Safari 在
                // 聚焦 font-size < 16px 的输入框时会强制放大整个页面，用户
                // 一按搜索框页面就跳一下、退出时还停在放大状态。16px 是那条
                // 阈值，桌面端再用回 14px。`/tools` 的搜索框同一条规则。
                className="h-11 w-full rounded-full border border-foreground/10 bg-card pl-10 pr-20 text-base outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-gongke-accent/40 focus:ring-2 focus:ring-gongke-accent/15 sm:text-sm"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    aria-label="清空搜索"
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                <kbd className="hidden rounded border border-foreground/10 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
                  /
                </kbd>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
                filtersOpen || cats.length || source || range !== 'all'
                  ? 'border-gongke-accent/30 bg-gongke-accent/10 text-gongke-accent'
                  : 'border-foreground/10 bg-card text-foreground/70 hover:border-foreground/20'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">筛选</span>
              {(cats.length > 0 || source) && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gongke-accent px-1 text-[10px] font-bold text-white">
                  {cats.length + (source ? 1 : 0)}
                </span>
              )}
            </button>

            {/* 工具条的右端：结果计数与重置。手机上收进下一行，避免把搜索框
                挤成一条缝。 */}
            <div className="ml-auto hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
              <span className="tabular-nums">
                <strong className="font-semibold text-foreground/80">{filtered.length}</strong> 条
              </span>
              {hasFilter && (
                <button
                  onClick={reset}
                  className="rounded-full border border-foreground/10 px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:border-foreground/20 hover:text-foreground"
                >
                  重置筛选
                </button>
              )}
            </div>
          </div>

          {/* 时间分段控件：始终可见，是最高频的筛选。 */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {NEWS_RANGES.map((r) => {
              const on = range === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  aria-pressed={on}
                  className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-3.5 text-[13px] font-medium transition-all duration-200 active:scale-95 sm:min-h-0 sm:px-3 sm:py-1 sm:text-xs ${
                    on
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
            {/* ≥sm 时计数与重置在第一行右端，这一行只留时间区间；手机上这里
                是它们唯一的位置，所以保留但隐藏于宽屏。 */}
            <span className="mx-1 h-4 w-px shrink-0 bg-foreground/10 sm:hidden" aria-hidden="true" />
            <span
              className="shrink-0 text-xs text-muted-foreground sm:hidden"
              aria-live="polite"
            >
              <strong className="font-semibold tabular-nums text-foreground/80">
                {filtered.length}
              </strong>{' '}
              条
            </span>
            {hasFilter && (
              <button
                onClick={reset}
                className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:hidden"
              >
                重置
              </button>
            )}
          </div>

          {/* 展开的分类 / 来源筛选 */}
          {filtersOpen && (
            <div className="mt-3 space-y-3 rounded-2xl border border-foreground/10 bg-card p-3.5 animate-[sheet-fade_0.2s_ease-out]">
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  分类
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {facets.map((f) => {
                    const on = cats.includes(f.id);
                    const tone = categoryTone(f.slug);
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleCat(f.id)}
                        aria-pressed={on}
                        // 手机上 34px 高的 chip 点起来发飘（面板里一次要连点
                        // 好几个分类），`max-sm:py-2.5` 提到 38px；桌面保持
                        // 紧凑，26 个分类才排得下两行。
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 max-sm:py-2.5 text-xs transition-all duration-150 active:scale-95 ${
                          on ? 'border-transparent font-medium' : 'border-foreground/10 text-foreground/65 hover:border-foreground/20'
                        }`}
                        style={
                          on
                            ? { background: tone.wash, color: tone.text, borderColor: tone.bar }
                            : undefined
                        }
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: tone.bar }}
                          aria-hidden="true"
                        />
                        {f.label}
                        <span className="tabular-nums opacity-60">{f.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  来源
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sources.map((s) => {
                    const on = source === s.name;
                    return (
                      <button
                        key={s.name}
                        onClick={() => setSource(on ? '' : s.name)}
                        aria-pressed={on}
                        className={`max-w-full truncate rounded-full border px-2.5 py-1 max-sm:py-2 text-xs transition-all duration-150 active:scale-95 ${
                          on
                            ? 'border-gongke-accent bg-gongke-accent text-white'
                            : 'border-foreground/10 text-foreground/65 hover:border-foreground/20'
                        }`}
                      >
                        {s.name}
                        <span className="ml-1 tabular-nums opacity-60">{s.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {months.length > 1 && (
                <p className="border-t border-foreground/5 pt-2.5 text-[11px] text-muted-foreground">
                  时间跨度：{months[months.length - 1].label} – {months[0].label}
                  <span className="ml-2 text-muted-foreground">
                    （共 {months.reduce((n, m) => n + m.count, 0)} 条）
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 资讯列表 ───────────────────────────────────────────── */}
      {/* 列表与上面的筛选条共用 `.content-container`（定义见 `globals.css`
          末尾）。卡片本身随列数变窄，阅读宽度靠**列宽**保证，而不是靠把整个
          版块压回 1088 —— 后者在 2560 下会在两侧各留 640px 的空白。 */}
      <div className="content-container mt-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/15 px-6 py-20 text-center">
            <Newspaper className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground/70">没有匹配的资讯</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {hasFilter
                ? '试试放宽时间范围、去掉分类，或换一个关键词。'
                : '资讯数据还没抓取，先跑一次 npm run news:fetch。'}
            </p>
            {hasFilter && (
              <button
                onClick={reset}
                className="mt-4 rounded-full bg-gongke-accent px-4 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:bg-gongke-accent/90 active:scale-95"
              >
                清除全部筛选
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {visibleGroups.map((g) => (
              <section key={g.key || 'unknown'}>
                {/* 组头：sticky 在筛选条下沿（由 `--news-filter-h` 实测给出，
                    见文件顶部的 ResizeObserver）。 */}
                <div
                  className="sticky z-10 mb-2 flex items-baseline gap-2 bg-background/90 py-1.5 backdrop-blur-xl"
                  style={{
                    top: 'calc(var(--site-header-h, 3.5rem) + 3.25rem + var(--news-filter-h, 6.4375rem))',
                  }}
                >
                  <h2 className="text-sm font-bold text-foreground">
                    {g.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {formatDateShort(g.items[0]?.publishedAt)}
                    {g.weekday && ` · ${g.weekday}`}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {g.items.length} 条
                  </span>
                </div>

                {/* 卡片按天分组，组内是网格：1760 下两列（≥1280）、三列
                    （≥2100）。单列时每张卡横跨 1760，摘要被拉成一行 100+
                    字符，所以宽度**只能**通过拆列拿到。
                    `grid-cols-1` 必须显式写：Tailwind 的 `grid` 只有
                    `display:grid`，默认列宽 `auto` 会按最长的中文标题撑开，
                    手机上整页横向可拖。 */}
                <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2 5xl:grid-cols-3">
                  {g.items.map((it, i) => (
                    // 用 `Reveal as="li"` 而不是在 li 里再包一层 div：
                    // 多包一层时 `h-full` 传不到卡片上，同一行里长短不一的
                    // 卡片会各按自身内容高度收尾，底边参差。
                    <Reveal
                      as="li"
                      key={it.id}
                      delay={Math.min(i, 6)}
                      className="min-w-0"
                    >
                      <NewsCard item={it} linkedTools={linkedToolMap.get(it.id) ?? []} />
                    </Reveal>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {visibleCount < filtered.length && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setLimit((l) => l + PAGE)}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-5 py-2.5 text-sm font-medium text-foreground/75 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/30 hover:text-foreground hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              加载更多（还有 {filtered.length - visibleCount} 条）
            </button>
          </div>
        )}

        {/* `text-balance`：390 下这段版权说明折成两行，末行只剩「来源。」，
            而它前面还挂着一个 `<span className="ml-1">` 的计数句。均衡换行把
            尾句整句挪到第二行，比孤零零三个字收尾稳。 */}
        <p className="mt-10 border-t border-foreground/10 pt-5 text-balance text-xs leading-relaxed text-muted-foreground">
          资讯精选与中文摘要来自{' '}
          <a
            href="https://aihot.news"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-6 items-center underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
          >
            AIHOT
          </a>
          ，版权归各来源与原作者所有；本站仅作聚合展示，点击标题可阅读原文。
          {filtered.length > 0 && (
            <span className="ml-1">
              当前 {filtered.length} 条，覆盖 {sources.length} 个来源。
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * 一张资讯卡片。
 *
 * 左侧 2px 分类色条是扫读的主线索；标题两行截断（摘要三行），保证同一屏内
 * 卡片高度一致、不会因为长短文而参差。整卡是一个外链 `<a>`，但「来源」与
 * 「AIHOT 条目」是独立的小链接 —— 嵌套 `<a>` 是无效 HTML，所以它们放在主
 * 链接之外，用 `stopPropagation` 把点击与卡片跳转分开。
 */
function NewsCard({
  item,
  linkedTools = [],
}: {
  item: NewsItem;
  /** 这条资讯里提到的站内工具（构建期匹配，见 `lib/news-links.ts`）。 */
  linkedTools?: { slug: string; name: string; icon: string }[];
}) {
  const tone = categoryTone(item.category);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-foreground/10 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md active:translate-y-0 active:scale-[0.995]">
      <span
        className="absolute inset-y-0 left-0 w-[2.5px] transition-all duration-200 group-hover:w-[3.5px]"
        style={{ background: tone.bar }}
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col p-4 pl-5 md:p-5 md:pl-6">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
            style={{ background: tone.wash, color: tone.text }}
          >
            {item.categoryLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <time dateTime={item.publishedAt ?? undefined} title={formatDateTime(item.publishedAt)}>
              {formatDateShort(item.publishedAt)}
            </time>
          </span>
          <span className="min-w-0 truncate text-muted-foreground">{item.source}</span>
        </div>

        {/* `text-balance`：卡片宽 320–542px，标题大多正好折成两行，均衡换行
            前常出现末行只剩一两个字的孤行（1440 下 16px 的「费」、2560 下
            31px 的「自由」）。实测 390/768/1440/2560 四档孤行数 2/0/2/4 → 0，
            并且 `truncated` 数不变（`line-clamp-2` 真的截断时仍是两条线，
            不会被均衡换行挤掉可见文字）。 */}
        <h3 className="text-balance text-[15px] font-semibold leading-snug text-foreground/90 transition-colors group-hover:text-gongke-accent md:text-base">
          <a
            href={item.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 after:absolute after:inset-0 after:content-['']"
          >
            <HeadlineText text={item.title} />
          </a>
          <ArrowUpRight
            className="ml-1 inline h-3.5 w-3.5 -translate-y-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60"
            aria-hidden="true"
          />
        </h3>

        {item.summary && (
          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground/70">
            {item.summary}
          </p>
        )}

        {/* `mt-auto`：同一行里摘要长短不一时，把「AIHOT 条目 / 入选理由」
            这一行压到卡片底部，多列布局下才能对齐。 */}
        {/* 站内条目：这条新闻里提到的工具，如果站内收录了就挂一个 chip。
            原先资讯与工具目录**零互链**（work/analysis-ia.md §7），读者读到
            「某产品发布」没有任何路径回到站内收录页，结构上把同一个站拆成
            两个产品。chip 必须 `relative z-10` 才能盖住标题链接的 `after:inset-0`
            大面积点击层（整卡可点），否则点 chip 会跳去外链。 */}
        {linkedTools.length > 0 && (
          <div className="relative z-10 mt-2.5 flex flex-wrap gap-1.5">
            {linkedTools.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="inline-flex items-center gap-1 rounded-md border border-foreground/10 bg-foreground/[0.02] px-1.5 py-0.5 text-[11px] text-foreground/70 transition-colors hover:border-gongke-accent/30 hover:text-gongke-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.icon}
                  alt=""
                  width={12}
                  height={12}
                  loading="lazy"
                  className="h-3 w-3 rounded-[2px] object-contain"
                />
                站内收录 · {t.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 text-[11px] text-muted-foreground">
          {item.originalTitle && item.originalTitle !== item.title && (
            <span className="line-clamp-1 max-w-full text-muted-foreground">
              {item.originalTitle}
            </span>
          )}
          {item.aihotUrl && (
            <a
              href={item.aihotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 ml-auto inline-flex min-h-6 items-center gap-0.5 rounded-full px-1.5 py-1.5 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              AIHOT 条目
            </a>
          )}
          {item.reason && (
            <details className="relative z-10 w-full">
              {/* `-my-1 py-2` 让行高不变但命中区有 24px，满足移动端最小触控目标。 */}
              <summary className="-my-1 inline-flex min-h-6 cursor-pointer list-none items-center gap-1 py-2 text-[11px] text-gongke-accent/80 transition-colors hover:text-gongke-accent [&::-webkit-details-marker]:hidden">
                <Flame className="h-3 w-3" aria-hidden="true" />
                入选理由
                <ChevronDown className="h-3 w-3 transition-transform" />
              </summary>
              <p className="mt-1 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5 text-balance text-[11px] leading-relaxed text-foreground/70">
                {item.reason}
              </p>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
