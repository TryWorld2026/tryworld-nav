'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { TOOL_GRID, ToolMiniCard } from './tool-card';
import { CategoryIcon } from './category-icon';
import { Button } from './ui/button';
import { rgb, rgbAlpha } from '@/lib/utils';
import {
  buildFilter,
  clampPage,
  emptyFilter,
  hasFilter,
  parseFilter,
  type FilterState,
} from '@/lib/filter-url';
import { CATALOG_INDEX } from '@/lib/catalog-index';
import { cardFromRecord } from '@/lib/card';
import { filterRecords, searchIndex, sortRecords } from '@/lib/search';
import type { Category, Tag } from '@/lib/types';

const PAGE = 60;
/** 累计上限。全展开 2081 张卡会把页面撑到 2.6 万节点、滚动掉到 30fps。 */
const HARD_CAP = 1200;

/** 价格筛选的三档 —— `free` 是历史别名，展开成「完全免费 + 开源」共 238 条。 */
const PRICE_FILTERS = [
  { value: 'free', label: '免费' },
  { value: 'freemium', label: '免费增值' },
  { value: 'paid', label: '付费' },
] as const;

const SORTS = [
  { value: '', label: '默认' },
  { value: 'updated', label: '最近更新' },
  { value: 'name', label: '按名称' },
] as const;

/**
 * 工具目录的筛选器。
 *
 * 2026-10-22：数据源从「服务端序列化 2081 个完整 Tool」改成直接读
 * `data/search-index.json` 解出来的 `CATALOG_INDEX`（`lib/catalog-index.ts`）。
 *
 * 为什么：`Tool` 对象里 `image`（每条约 55 字符的截图路径）、`variant`、
 * `link`、`rawName` 这些字段卡片根本不读，但它们全被序列化进了 HTML ——
 * `/tools` 的 HTML 因此有 1.16 MB。索引里已经有卡片需要的全部字段（slug /
 * 名称 / 简介 / 图标 / 分类 / 标签 / 价格 / 平台 / 更新时间），而且它本来就
 * 要下发给浏览器做搜索，等于**同一份数据不再付两次钱**。
 *
 * 2026-10-18 那一轮的核心是**把状态写回 URL**（原来只在挂载时读一次）：
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
 *   2. 输入框 250 ms 防抖；分类/标签/价格/排序点击立即写（用户预期是「点了就变」）。
 *   3. 监听 `popstate` 回填 —— 这是「返回后筛选还在」的唯一实现方式。
 *
 * 2026-10-22 新增三件事，都是审计里「选不出来」的直接对策：
 *
 *   - **排序**（默认 / 最近更新 / 按名称）。原来只能按目录顺序读，2081 条里
 *     最新的一条排在第 1700 位，读者永远遇不到它。
 *   - **平台筛选**。一个只有 iOS 的工具对 Windows 用户是零，而这条信息
 *     以前完全不在筛选器里。
 *   - **价格档位**。原来只有一个「只看免费」布尔开关，把「免费增值」
 *     （1737 条，83%）这一档整个藏起来了。
 */
export function ToolsExplorer({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter);
  // 手机上的分类墙折叠。26 个分类 chip 铺开是 404px，390 宽的首屏里一张工具
  // 卡都露不出来；折叠到 8 个之后第一张卡落在 540px 左右，844 高的手机上完整
  // 可见。折叠只发生在手机上（`max-md:!hidden`），桌面仍然一次列全。
  const [expanded, setExpanded] = useState(false);
  const MOBILE_CATEGORY_LIMIT = 8;

  // URL → state：挂载时一次，之后每次 popstate（浏览器前进/后退）一次。
  const applyUrl = useCallback((search: string) => {
    setFilter(parseFilter(search));
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

  /**
   * 改一处筛选并重置页码。
   *
   * 每次筛选变化都必须回到第 1 页 —— 否则「筛到第 5 页 → 再加一个分类」
   * 会停在一个只剩 12 条的结果的第 5 页上，页面看起来是空的。
   */
  const update = useCallback(
    (patch: Partial<FilterState>, immediate = true) => {
      setFilter((prev) => {
        const next = { ...prev, ...patch, page: 1 };
        scheduleUrl(next, immediate);
        return next;
      });
    },
    [scheduleUrl],
  );

  // 价格 / 平台的档位与计数（从索引算一次，2081 × 2 次遍历可以忽略）。
  const priceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of CATALOG_INDEX) counts.set(r.p, (counts.get(r.p) ?? 0) + 1);
    const free = (counts.get('fully-free') ?? 0) + (counts.get('open-source') ?? 0);
    return PRICE_FILTERS.map((o) => ({
      ...o,
      count: o.value === 'free' ? free : (counts.get(o.value) ?? 0),
    })).filter((o) => o.count > 0);
  }, []);

  const platformOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of CATALOG_INDEX) {
      for (const p of r.pl) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, []);

  const results = useMemo(() => {
    const base = filterRecords(CATALOG_INDEX, {
      cats: filter.cats,
      tags: filter.tags,
      price: filter.price,
      platforms: filter.platforms,
    });

    const q = filter.q.trim();
    if (!q) return sortRecords(base, filter.sort);

    // 有查询词时用同一个搜索函数（与命令面板一致），再与分类/标签取交集。
    // 顺序默认保留**相关度**（`searchIndex` 的返回顺序）；读者显式选了排序
    // 才覆盖它 —— 「最近更新」在搜索语境下仍然有意义（我要最新的那个）。
    const allowed = new Set(base.map((r) => r.s));
    const hits = searchIndex(CATALOG_INDEX, q, Number.POSITIVE_INFINITY).filter((h) =>
      allowed.has(h.slug),
    );
    if (!filter.sort) {
      const bySlug = new Map(base.map((r) => [r.s, r]));
      return hits.map((h) => bySlug.get(h.slug)).filter((r) => r !== undefined);
    }
    const bySlug = new Map(base.map((r) => [r.s, r]));
    const ordered = hits.map((h) => bySlug.get(h.slug)).filter((r) => r !== undefined);
    return sortRecords(ordered, filter.sort);
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE));
  const page = clampPage(filter.page, totalPages);
  const visible = results.slice(0, Math.min(page * PAGE, HARD_CAP));

  function toggleCategory(slug: string) {
    const next = filter.cats.includes(slug)
      ? filter.cats.filter((s) => s !== slug)
      : [...filter.cats, slug];
    update({ cats: next });
  }

  function toggleTag(name: string) {
    const next = filter.tags.includes(name)
      ? filter.tags.filter((s) => s !== name)
      : [...filter.tags, name];
    update({ tags: next });
  }

  function togglePlatform(name: string) {
    const next = filter.platforms.includes(name)
      ? filter.platforms.filter((s) => s !== name)
      : [...filter.platforms, name];
    update({ platforms: next });
  }

  function togglePrice(value: string) {
    update({ price: filter.price === value ? '' : value });
  }

  function reset() {
    // 必须先掐掉待触发的 250ms 防抖：否则「输入关键词 → 立刻点重置筛选」时，
    // 那个定时器会在重置之后把刚清掉的 query 重新写回地址栏，
    // 出现「输入框是空的、URL 里还挂着 ?q=…」的错位。
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setFilter(emptyFilter());
    pushUrl(emptyFilter());
  }

  /**
   * 空结果里的「从一个分类开始」。
   *
   * 这里**不能**写成 `reset(); setTimeout(() => toggleCategory(slug))`：那个
   * 回调闭包里的 `filter` 还是点击前那一帧的值，于是新分类会被追加到旧筛选上，
   * 而且 `scheduleUrl` 会把旧的关键词重新写回 URL —— 界面显示「分类=设计」，
   * 地址栏却是 `?q=旧词&cat=设计`，刷新后又变回去。
   */
  function startFromCategory(slug: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const next: FilterState = { ...emptyFilter(), cats: [slug] };
    setFilter(next);
    pushUrl(next);
  }

  /** 空结果时的出路：取前 3 个分类。 */
  const suggestedCats = useMemo(
    () => (results.length > 0 ? [] : categories.slice(0, 3)),
    [results.length, categories],
  );

  const chip = (on: boolean) =>
    (on
      ? 'inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent'
      : 'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground') +
    // 触控目标：手机上 chip 高度 30px，低于 44px 建议值（a11y 审计的
    // 「24–44px 那批」）。max-md 抬到 36px，桌面维持原密度。
    ' max-md:min-h-9 max-md:py-1.5';

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
            value={filter.q}
            onChange={(e) => update({ q: e.target.value }, false)}
            placeholder="搜索工具名称、简介，或直接说你想做什么…"
            aria-label="搜索工具名称、简介或分类"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
          />
          {filter.q && (
            <button
              type="button"
              onClick={() => update({ q: '' })}
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
                  aria-pressed={filter.tags.includes(t.name)}
                  className={chip(filter.tags.includes(t.name)) + ' shrink-0'}
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
            const on = filter.cats.includes(c.slug);
            const foldedOnMobile = !expanded && i >= MOBILE_CATEGORY_LIMIT && !on;
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
          {priceOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => togglePrice(o.value)}
              aria-pressed={filter.price === o.value}
              className={chip(filter.price === o.value)}
            >
              {o.label} · {o.count}
            </button>
          ))}
        </div>

        {platformOptions.length > 1 && (
          <div className="relative -mx-4 md:static md:mx-0">
            <div className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto px-4 md:flex-wrap md:overflow-visible md:px-0">
              <span className="sticky left-0 shrink-0 bg-background pr-2 text-xs text-muted-foreground">
                平台
              </span>
              {platformOptions.map((o) => (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => togglePlatform(o.name)}
                  aria-pressed={filter.platforms.includes(o.name)}
                  className={chip(filter.platforms.includes(o.name)) + ' shrink-0'}
                >
                  {o.name}
                  <span className="text-[11px] opacity-60">{o.count}</span>
                </button>
              ))}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          共 <span className="font-medium text-foreground">{results.length}</span> 个工具
          {totalPages > 1 && (
            <span className="ml-2 text-xs">
              第 {page} / {totalPages} 页
            </span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {/* 排序：默认（目录序 / 搜索相关度）、最近更新、按名称。
              2081 条里最新的一条排在目录第 1700 位 —— 没有这个控件，读者
              永远遇不到它，而「最近有什么新的」是导航站的第二高频问题。 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">排序</span>
            {SORTS.map((s) => (
              <button
                key={s.value || 'default'}
                type="button"
                onClick={() => update({ sort: s.value })}
                aria-pressed={filter.sort === s.value}
                className={
                  filter.sort === s.value
                    ? 'rounded px-1.5 py-0.5 text-xs font-medium text-foreground'
                    : 'rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          {hasFilter(filter) && (
            <Button variant="ghost" size="sm" onClick={reset}>
              重置筛选
            </Button>
          )}
        </div>
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
            {visible.map((r) => (
              <div
                key={r.s}
                // 长列表的渲染成本：默认浏览器要为 2000+ 张卡算样式与布局。
                // `content-visibility:auto` 让视口外的卡片跳过渲染，
                // `contain-intrinsic-size` 给一个占位高度避免滚动条抖动。
                className="[contain-intrinsic-size:auto_104px] [content-visibility:auto]"
              >
                <ToolMiniCard tool={cardFromRecord(r)} />
              </div>
            ))}
          </div>
          {results.length > visible.length && (
            <div className="flex flex-col items-center gap-2 pt-2">
              {page * PAGE < HARD_CAP ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    const next = { ...filter, page: page + 1 };
                    setFilter(next);
                    pushUrl(next);
                  }}
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
