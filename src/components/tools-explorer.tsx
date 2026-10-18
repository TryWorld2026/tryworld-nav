'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { TOOL_GRID, ToolMiniCard } from './tool-card';
import { CategoryIcon } from './category-icon';
import { Button } from './ui/button';
import { rgb, rgbAlpha } from '@/lib/utils';
import {
  buildFilter,
  emptyFilter,
  hasFilter,
  parseFilter,
  type FilterState,
} from '@/lib/filter-url';
import { filterRecords, searchIndex, type SearchRecord } from '@/lib/search';
import type { Category, Tag, Tool } from '@/lib/types';
import rawSearchIndex from '../../data/search-index.json';

const INDEX = rawSearchIndex as SearchRecord[];
const BY_SLUG = new Map(INDEX.map((r) => [r.s, r]));

const PAGE = 60;
/** 累计上限。全展开 2081 张卡会把页面撑到 2.6 万节点、滚动掉到 30fps。 */
const HARD_CAP = 1200;

/**
 * 工具目录的筛选器。
 *
 * 2026-10-18 重做，核心是**把状态写回 URL**（原来只在挂载时读一次）：
 *
 *   原实测（work/analysis-ia.md §9①）：输入「视频」+ 点「AI视频/动画」→ 297 条，
 *   URL 仍是 `/tools`；点进详情再按浏览器返回 → 计数回到 2081、输入框清空、
 *   chip 清空、滚动位置 1200 → 160。「筛一遍 → 看一个 → 回来接着挑」是导航站
 *   最高频的动作，这里每次都从头开始，链接也没法分享。
 *
 * 三个实现要点：
 *
 *   1. 用 `history.replaceState` 而不是 `router.replace`。后者每次击键都会向
 *      Next 请求一次 RSC payload（这个站每个链接都预取 `.txt?_rsc=`），
 *      打字会变成一串网络请求。replaceState 只改地址栏，不动路由。
 *   2. 输入框 250 ms 防抖；分类/标签点击立即写（用户预期是「点了就变」）。
 *   3. 监听 `popstate` 回填 —— 这是「返回后筛选还在」的唯一实现方式。
 *
 * 另外两处顺带修掉的体验问题：
 *   - 空结果时给出「试试这些分类」的出路，而不是一句「没有匹配的工具」；
 *   - 加载更多从 +120 改成 +60，并给累计上限。
 */
export function ToolsExplorer({
  tools,
  categories,
  tags,
  freeSlugs,
}: {
  tools: Tool[];
  categories: Category[];
  tags: Tag[];
  /** 「免费 / 免费开源」两档的 slug 白名单，用于 `?price=free`。 */
  freeSlugs: string[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState('');
  const [price, setPrice] = useState('');
  const [limit, setLimit] = useState(PAGE);
  // 手机上的分类墙折叠。26 个分类 chip 铺开是 404px，390 宽的首屏里一张工具
  // 卡都露不出来；折叠到 8 个之后第一张卡落在 540px 左右，844 高的手机上完整
  // 可见。折叠只发生在手机上（`max-md:!hidden`），桌面仍然一次列全。
  const [expanded, setExpanded] = useState(false);
  const MOBILE_CATEGORY_LIMIT = 8;

  const freeSet = useMemo(() => new Set(freeSlugs), [freeSlugs]);

  // URL → state：挂载时一次，之后每次 popstate（浏览器前进/后退）一次。
  const applyUrl = useCallback((search: string) => {
    const next = parseFilter(search);
    setQuery(next.q);
    setActive(next.cats);
    setActiveTag(next.tag);
    setPrice(next.price);
    setLimit(PAGE);
  }, []);

  useEffect(() => {
    applyUrl(window.location.search);
    const onPop = () => applyUrl(window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyUrl]);

  // state → URL：replaceState 不触发 Next 路由，只更新地址栏。
  const pushUrl = useCallback((next: FilterState) => {
    const qs = buildFilter(next);
    const target = `${window.location.pathname}${qs}`;
    if (target !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', target);
    }
  }, []);

  // 输入 250ms 防抖，其余立即。
  const debounceRef = useRef<number | null>(null);
  const scheduleUrl = useCallback(
    (next: FilterState, immediate = false) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (immediate) {
        pushUrl(next);
        return;
      }
      debounceRef.current = window.setTimeout(() => pushUrl(next), 250);
    },
    [pushUrl],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    [],
  );

  // 当前完整状态（供 URL 与筛选共用）。
  const state = useMemo<FilterState>(
    () => ({ q: query, cats: active, tag: activeTag, price }),
    [query, active, activeTag, price],
  );

  const results = useMemo(() => {
    const base = filterRecords(INDEX, {
      categories: active,
      tag: activeTag,
      price,
      freeSlugs: freeSet,
    });
    const q = query.trim();
    if (!q) return base;

    // 有查询词时用同一个搜索函数（与命令面板一致），再与分类/标签取交集。
    const allowed = new Set(base.map((r) => r.s));
    return searchIndex(INDEX, q, Number.POSITIVE_INFINITY)
      .filter((h) => allowed.has(h.slug))
      .map((h) => BY_SLUG.get(h.slug))
      .filter((r): r is SearchRecord => Boolean(r));
  }, [active, activeTag, price, freeSet, query]);

  /** 结果 slug → Tool，卡片渲染要完整 Tool（含图标/分类色点）。 */
  const toolBySlug = useMemo(() => new Map(tools.map((t) => [t.slug, t])), [tools]);
  const visible = results.slice(0, limit);

  function toggleCategory(slug: string) {
    const next = active.includes(slug) ? active.filter((s) => s !== slug) : [...active, slug];
    setActive(next);
    setLimit(PAGE);
    scheduleUrl({ ...state, cats: next }, true);
  }

  function toggleTag(name: string) {
    const next = activeTag === name ? '' : name;
    setActiveTag(next);
    setLimit(PAGE);
    scheduleUrl({ ...state, tag: next }, true);
  }

  function togglePrice() {
    const next = price === 'free' ? '' : 'free';
    setPrice(next);
    setLimit(PAGE);
    scheduleUrl({ ...state, price: next }, true);
  }

  function reset() {
    // 必须先掐掉待触发的 250ms 防抖：否则「输入关键词 → 立刻点重置筛选」时，
    // 那个定时器会在重置之后把刚清掉的 query 重新写回地址栏，
    // 出现「输入框是空的、URL 里还挂着 ?q=…」的错位。
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setQuery('');
    setActive([]);
    setActiveTag('');
    setPrice('');
    setLimit(PAGE);
    pushUrl(emptyFilter());
  }

  /**
   * 空结果里的「从一个分类开始」。
   *
   * 这里**不能**写成 `reset(); setTimeout(() => toggleCategory(slug))`：那个
   * 回调闭包里的 `active` / `state` 还是点击前那一帧的值，于是新分类会被
   * 追加到旧筛选上，而且 `scheduleUrl` 会把旧的关键词重新写回 URL ——
   * 界面显示「分类=设计」，地址栏却是 `?q=旧词&cat=设计`，刷新后又变回去。
   */
  function startFromCategory(slug: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setQuery('');
    setActive([slug]);
    setActiveTag('');
    setPrice('');
    setLimit(PAGE);
    pushUrl({ q: '', cats: [slug], tag: '', price: '' });
  }

  /** 空结果时的出路：取前 3 个分类。 */
  const suggestedCats = useMemo(
    () => (results.length > 0 ? [] : categories.slice(0, 3)),
    [results.length, categories],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        {/* 搜索框在 2560 下会拉成 1696px 的空带 —— 一个单行输入框铺满整版
            只会让读者以为哪里没加载完。限宽加在定位外层，放大镜与清空按钮
            跟着一起收窄；手机上仍是满宽。 */}
        <div className="relative md:max-w-2xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              setLimit(PAGE);
              scheduleUrl({ ...state, q: next });
            }}
            placeholder="搜索工具名称、简介，或直接说你想做什么…"
            aria-label="搜索工具名称、简介或分类"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setLimit(PAGE);
                scheduleUrl({ ...state, q: '' }, true);
              }}
              aria-label="清空搜索"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-foreground/5"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {tags.length > 0 && (
          /* 手机上单行横滑（26 个标签铺开是第二道墙），桌面回到换行。
             标签名用 sticky 钉在左侧，横滑时不会跟着滚走；右缘一道渐隐，
             提示右边还有内容 —— 直接切掉半个 chip 看起来像溢出。 */
          <div className="relative -mx-4 md:static md:mx-0">
            <div className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto px-4 md:flex-wrap md:overflow-visible md:px-0">
              <span className="sticky left-0 shrink-0 bg-background pr-2 text-xs text-muted-foreground">
                标签
              </span>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.name)}
                  aria-pressed={activeTag === t.name}
                  className={
                    (activeTag === t.name
                      ? 'inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent'
                      : 'inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground') +
                    // 触控目标：手机上 chip 高度 30px，低于 44px 建议值（a11y 审计
                    // 的「24–44px 那批」）。max-md 抬到 36px，桌面维持原密度。
                    ' max-md:min-h-9 max-md:py-1.5'
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden"
            />
          </div>
        )}

        <div id="tools-category-chips" className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">分类</span>
          {categories.map((c, i) => {
            const on = active.includes(c.slug);
            const foldedOnMobile =
              !expanded && i >= MOBILE_CATEGORY_LIMIT && !active.includes(c.slug);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.slug)}
                aria-pressed={on}
                className={
                  (on
                    ? // A transparent border keeps the chip the same height as the
                      // unselected ones, so the row doesn't jump when toggling.
                      'inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium'
                    : 'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground') +
                  (foldedOnMobile ? ' max-md:!hidden' : '') +
                  ' max-md:min-h-9 max-md:py-1.5'
                }
                style={
                  on ? { background: rgbAlpha(c.color, 0.14), color: rgb(c.color) } : undefined
                }
              >
                <CategoryIcon name={c.icon} className="h-3 w-3" />
                {c.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="tools-category-chips"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground max-md:min-h-9 max-md:py-1.5 md:hidden"
          >
            {expanded ? '收起分类' : `全部分类（${categories.length}）`}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">价格</span>
          <button
            type="button"
            onClick={togglePrice}
            aria-pressed={price === 'free'}
            className={
              price === 'free'
                ? 'inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent max-md:min-h-9 max-md:py-1.5'
                : 'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground max-md:min-h-9 max-md:py-1.5'
            }
          >
            只看免费 · {freeSlugs.length}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          共 <span className="font-medium text-foreground">{results.length}</span> 个工具
        </p>
        {hasFilter(state) && (
          <Button variant="ghost" size="sm" onClick={reset}>
            重置筛选
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">没有匹配的工具。</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            换个说法试试，或先从一个分类进去看看。
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {suggestedCats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => startFromCategory(c.slug)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-foreground/25"
              >
                <CategoryIcon name={c.icon} className="h-3.5 w-3.5" />
                {c.name}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={reset}>
              清空筛选
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 列数由 `TOOL_GRID` 的 280px 最小轨道决定，与首页/分类页/集合页
              同一条规则：1440 四列 284、1536 四列 308、≥2100 五列 326。 */}
          <div className={TOOL_GRID}>
            {visible.map((r) => {
              const t = toolBySlug.get(r.s);
              if (!t) return null;
              return (
                <div
                  key={r.s}
                  // 长列表的渲染成本：默认浏览器要为 2000+ 张卡算样式与布局。
                  // `content-visibility:auto` 让视口外的卡片跳过渲染，
                  // `contain-intrinsic-size` 给一个占位高度避免滚动条抖动。
                  className="[contain-intrinsic-size:auto_104px] [content-visibility:auto]"
                >
                  <ToolMiniCard tool={t} />
                </div>
              );
            })}
          </div>
          {results.length > visible.length && (
            <div className="flex flex-col items-center gap-2 pt-2">
              {limit < HARD_CAP ? (
                <Button
                  variant="outline"
                  onClick={() => setLimit((l) => Math.min(HARD_CAP, l + PAGE))}
                  className="border-border text-foreground/80"
                >
                  加载更多（还有 {Math.min(results.length, HARD_CAP) - visible.length} 个）
                </Button>
              ) : (
                <p className="max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
                  已显示前 {visible.length} 个（共 {results.length} 个）。一次全铺开会把页面撑到
                  2.6 万个节点、滚动掉到 30fps —— 用上方的分类或搜索收窄范围更快。
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
