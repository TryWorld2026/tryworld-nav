'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { TOOL_GRID, ToolMiniCard } from './tool-card';
import { CategoryIcon } from './category-icon';
import { FacetPanel, FacetRail } from './facet-rail';
import { FilterSheet } from './filter-sheet';
import { Button } from './ui/button';
import { rgb } from '@/lib/utils';
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
import { filterRecords, priceValuesFor, searchIndex, sortRecords } from '@/lib/search';
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

/**
 * 生效 chip 上显示的价格文案。必须是六档全集：URL 里可能留着
 * `fully-free` / `open-source` / `unrated` 这些不在三档筛选里的历史别名，
 * 只查 `PRICE_FILTERS` 会把它们显示成英文 slug。
 */
const PRICE_LABEL: Record<string, string> = {
  free: '免费',
  'fully-free': '免费',
  'open-source': '免费开源',
  freemium: '免费增值',
  paid: '付费',
  unrated: '未标注',
};

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
 * 2026-10-23：**四排 chip 墙重做成筛选面板**。
 *
 * 原状：搜索框下面连铺四排同一种灰胶囊（9 标签 / 26 分类 / 3 价格 / 18 平台），
 * 没有分组标题、没有计数、选中态只靠一层淡色底；结果统计与排序挤在右下一行。
 * 手机 390×844 上更糟 —— 26 个分类折成 8 个后还要再点一次「全部分类（26）」，
 * 首屏一张工具卡都露不出来。
 *
 * 现在：≥1024px 是两栏（248px 粘性左栏 + 结果区），<1024px 把同一份筛选装进
 * 底部抽屉（`filter-sheet.tsx`）。结构在 `facet-rail.tsx`，这里只负责状态、
 * 计数、URL 与结果区。
 *
 * **计数必须保持 facet 口径**：某个选项的数字 = 「其余筛选条件不变、只加上
 * 这一项」的命中数（每一维排除自己）。它不是全库静态数 —— 换成静态数之后
 * 读者会点进一个写着「297」却只剩 0 条的分类，而这正是旧版最误导的一处。
 */
export function ToolsExplorer({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter);
  /** 移动端底部抽屉。桌面左栏常驻，不读这个状态。 */
  const [sheetOpen, setSheetOpen] = useState(false);
  // 稳定的关闭回调：`FilterSheet` 的 Esc / matchMedia 两个 effect 依赖它，
  // 每次渲染都换新函数会让监听器反复解绑重绑（切一次视口就重挂一次焦点逻辑）。
  const closeSheet = useCallback(() => setSheetOpen(false), []);

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

  /**
   * 有查询词时先跑一次搜索，保留**有序**的命中列表。
   *
   * 两个用途，顺序都要：默认排序用它的相关度顺序；facet 计数用它的成员集合
   * —— 计数若只看分类/标签/价格/平台，搜「视频」时分类旁边会写着 500、点进
   * 去只剩 30，比不给计数更误导。
   */
  const searchHits = useMemo(
    () =>
      filter.q.trim() ? searchIndex(CATALOG_INDEX, filter.q, Number.POSITIVE_INFINITY) : null,
    [filter.q],
  );

  const hitOrder = useMemo(() => {
    if (!searchHits) return null;
    const m = new Map<string, number>();
    searchHits.forEach((h, i) => m.set(h.slug, i));
    return m;
  }, [searchHits]);

  /** 只含四个非文本维度：查询词在 `results` 与 facet 各自做交集。 */
  const base = useMemo(
    () =>
      filterRecords(CATALOG_INDEX, {
        cats: filter.cats,
        tags: filter.tags,
        price: filter.price,
        platforms: filter.platforms,
      }),
    [filter.cats, filter.tags, filter.price, filter.platforms],
  );

  const results = useMemo(() => {
    if (!hitOrder) return sortRecords(base, filter.sort);
    const matched = base.filter((r) => hitOrder.has(r.s));
    // 有查询词时默认排序是**相关度**（`searchIndex` 的返回顺序）；读者显式
    // 选了排序才覆盖它 —— 「最近更新」在搜索语境下仍然有意义（我要最新的那个）。
    if (filter.sort) return sortRecords(matched, filter.sort);
    return matched.sort((a, b) => (hitOrder.get(a.s) ?? 0) - (hitOrder.get(b.s) ?? 0));
  }, [base, hitOrder, filter.sort]);

  /**
   * facet 计数：**每一维排除自己**、其余条件（含查询词）不变。
   *
   *   count(分类 c) = 在「标签/价格/平台/查询词」不变的前提下，再加 cat=c 的命中数
   *
   * 一次遍历算完四维（2081 × 4 个布尔判断），所以打字时它也跟得上。四维各自
   * 检查的条件互不相同，无法合并成一个 `ok`，这是这段代码唯一啰嗦的地方。
   *
   * ── 搜索词零命中时的退让（2026-10-27）──────────────────────────────
   * 查询词自己命中 0 条时（`/tools?q=zzzz`），四个维度会**同时**变成 0：
   * 26 个分类、9 个标签、3 档价格、18 个平台全部显示 0，整块筛选面板变成
   * 一排读不出信息的灰字。实测这个状态下用户失去的唯一线索是「放松哪一维
   * 还有东西」—— 而答案其实是「哪一维都有，是你的词不对」。
   *
   * 所以这里分两种口径：
   *   - 正常态：计数含查询词（点进去确实只剩这么多）；
   *   - `queryMiss`：计数**不含**查询词，只反映分类/标签/价格/平台四维。
   *     同时把 `queryMiss` 抛给界面，由空态明说「下面的数字不含搜索词」——
   *     悄悄换口径比给 0 更误导。
   */
  const facet = useMemo(() => {
    const catSel = new Set(filter.cats);
    const tagSel = new Set(filter.tags);
    const platSel = new Set(filter.platforms.map((p) => p.toLowerCase()));
    const priceSel = new Set(priceValuesFor(filter.price));
    const catCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const priceCounts = new Map<string, number>();
    const platformCounts = new Map<string, number>();
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    // 查询词一条都没命中 → 计数改用「不含查询词」的口径，否则整块面板归零。
    const queryMiss = hitOrder !== null && hitOrder.size === 0;

    for (const r of CATALOG_INDEX) {
      if (hitOrder && !queryMiss && !hitOrder.has(r.s)) continue;
      const okCat = catSel.size === 0 || r.c.some((c) => catSel.has(c));
      const okTag = tagSel.size === 0 || r.t.some((t) => tagSel.has(t));
      const okPrice = priceSel.size === 0 || priceSel.has(r.p);
      const okPlat = platSel.size === 0 || r.pl.some((p) => platSel.has(p.toLowerCase()));
      if (okTag && okPrice && okPlat) for (const c of r.c) bump(catCounts, c);
      if (okCat && okPrice && okPlat) for (const t of r.t) bump(tagCounts, t);
      if (okCat && okTag && okPlat) bump(priceCounts, r.p);
      if (okCat && okTag && okPrice) for (const p of r.pl) bump(platformCounts, p);
    }
    return { catCounts, tagCounts, priceCounts, platformCounts, queryMiss };
  }, [filter.cats, filter.tags, filter.price, filter.platforms, hitOrder]);

  /** 三档价格恒显示 3 行（0 命中也留着，降到 40% 但仍可点）。 */
  const priceOptions = useMemo(
    () =>
      PRICE_FILTERS.map((o) => ({
        value: o.value,
        label: o.label,
        count:
          o.value === 'free'
            ? (facet.priceCounts.get('fully-free') ?? 0) + (facet.priceCounts.get('open-source') ?? 0)
            : (facet.priceCounts.get(o.value) ?? 0),
      })),
    [facet],
  );

  /**
   * 平台顺序固定按全库频次降序，**不能**按 facet 计数排：那样每点一个分类
   * 整个列表都在跳，读者刚想点的那一行会跑掉。
   */
  const platformRank = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of CATALOG_INDEX) {
      for (const p of r.pl) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, []);

  const platformOptions = useMemo(
    () => platformRank.map((name) => ({ name, count: facet.platformCounts.get(name) ?? 0 })),
    [platformRank, facet],
  );

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

  /** 生效的筛选**项数**（不含查询词与排序）：手机上按钮的徽章、左栏标题共用。 */
  const activeFacetCount =
    filter.cats.length + filter.tags.length + filter.platforms.length + (filter.price ? 1 : 0);

  const catBySlug = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);

  /**
   * 生效筛选的可移除 chips。
   *
   * 价格单独走 `PRICE_LABEL`：手改 URL 会留下历史别名（`?price=fully-free`、
   * `open-source`、`unrated`），只查 `PRICE_FILTERS` 会把这些渲染成裸 slug。
   */
  const activeChips = [
    ...filter.cats.map((slug) => ({
      key: `cat:${slug}`,
      label: catBySlug.get(slug)?.name ?? slug,
      color: catBySlug.get(slug)?.color as string | undefined,
      remove: () => toggleCategory(slug),
    })),
    ...filter.tags.map((name) => ({
      key: `tag:${name}`,
      label: name,
      color: undefined as string | undefined,
      remove: () => toggleTag(name),
    })),
    ...(filter.price
      ? [
          {
            key: `price:${filter.price}`,
            label: `价格：${PRICE_LABEL[filter.price] ?? filter.price}`,
            color: undefined as string | undefined,
            remove: () => update({ price: '' }),
          },
        ]
      : []),
    ...filter.platforms.map((name) => ({
      key: `platform:${name}`,
      label: `平台：${name}`,
      color: undefined as string | undefined,
      remove: () => togglePlatform(name),
    })),
  ];

  return (
    /* 两栏：≥1024px 左侧 248px 粘性筛选栏 + 右侧结果区；<1024px 塌成单列，
       同一份筛选面板改由底部抽屉承载（见文件末尾的 `FilterSheet`）。
       `items-start` 是粘性生效的前提；右侧 `min-w-0` 防止长分类名把整行推宽。 */
    <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <FacetRail
        categories={categories}
        tags={tags}
        catCounts={facet.catCounts}
        tagCounts={facet.tagCounts}
        priceOptions={priceOptions}
        platformOptions={platformOptions}
        selected={filter}
        onToggleCategory={toggleCategory}
        onToggleTag={toggleTag}
        onTogglePrice={togglePrice}
        onTogglePlatform={togglePlatform}
        activeCount={activeFacetCount}
        canClear={hasFilter(filter)}
        onClear={reset}
      />

      <div className="min-w-0 space-y-4">
        {/* 搜索框：整行宽、48px 高。左放大镜、右侧清空（手机上 44px 触控目标）。
            没有 `/` 快捷键提示 —— 本页的 `/` 绑在页眉的全站命令面板上
            （见 `header.tsx` 的 keydown），标在这里会承诺「按 / 聚焦这个框」。 */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={filter.q}
            onChange={(e) => update({ q: e.target.value }, false)}
            placeholder="搜索工具名称、简介，或直接说你想做什么…"
            aria-label="搜索工具名称、简介或分类"
            className="h-12 w-full rounded-md border border-border bg-background pl-10 pr-12 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring lg:text-sm"
          />
          {filter.q && (
            <button
              type="button"
              onClick={() => update({ q: '' })}
              aria-label="清空搜索"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors duration-200 hover:bg-foreground/5 max-lg:h-11 max-lg:w-11"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* <1024 的紧凑工具条：筛选（带生效数徽章）+ 结果数 + 排序下拉。
            每一项都 ≥44px 高；`flex-wrap` 兜住 320px 下最窄的一档 —— 宁可换行，
            也不让工具条把页面撑出横向滚动条。 */}
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            aria-controls="tools-filter-sheet"
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors duration-200 hover:border-foreground/25"
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            筛选
            {activeFacetCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gongke-accent px-1 text-2xs font-medium text-background">
                {activeFacetCount}
              </span>
            )}
          </button>
          <p
            className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            aria-live="polite"
          >
            共 <span className="font-medium text-foreground">{results.length}</span> 个工具
          </p>
          <select
            aria-label="排序方式"
            value={filter.sort}
            onChange={(e) => update({ sort: e.target.value as FilterState['sort'] })}
            className="h-11 shrink-0 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SORTS.map((s) => (
              <option key={s.value || 'default'} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* 生效筛选的 chips：每一项都能单独移除。查询词不在这里 —— 它就在
            上面的输入框里，右侧已有清空按钮，再放一枚 chip 是重复的。 */}
        {hasFilter(filter) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.remove}
                aria-label={`移除筛选：${c.label}`}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs text-foreground/80 transition-colors duration-200 hover:border-foreground/25 hover:text-foreground max-lg:h-11"
              >
                {c.color && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: rgb(c.color) }}
                  />
                )}
                <span className="max-w-[11rem] truncate">{c.label}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 shrink-0 items-center rounded-full px-2 text-xs text-gongke-accent transition-colors duration-200 hover:underline max-lg:h-11"
            >
              清除全部
            </button>
          </div>
        )}

        {/* ⚠️ 右栏**不能**在这里闭合。
            2026-10-23 实测：结果头与工具网格一度落在这个两栏 grid 外面，
            于是右栏只剩「搜索框 + 生效 chips」，网格被推到整条粘性左栏
            （26 分类 + 标签 + 价格 + 平台，约 800px）之后 —— 1440 首屏一张卡
            都看不到，页面看起来像「筛选器下面全白」。结构错了但 TSC 与构建
            都不报错，只有渲染出来才发现。 */}
        {/* 结果头只在 ≥1024 出现：<1024 的手机工具条（上面那段 `lg:hidden`）
            已经给了「筛选 / 共 N 个 / 排序」三件事，两层同时渲染会得到**同一行
            统计重复两遍**（2026-10-23 390 实测：`共 2081 个工具` 连着出现两次，
            第二次还带着「第 1 / 35 页 排序 默认 最近更新 按名称」—— 首屏下移 44px
            且看起来像没排版）。 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 max-lg:hidden">
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
          {/* 查询词零命中时左栏/抽屉的计数是「不含搜索词」的 —— 明说，
              否则读者会以为「AI图像/设计 336」这个数字是当前搜索的结果。 */}
          {facet.queryMiss && (
            <p className="mx-auto mt-2 max-w-md text-balance text-xs leading-relaxed text-muted-foreground">
              筛选里的数字不含你输入的搜索词，是各分类/标签本身的规模；
              清空搜索框就能看到它们。
            </p>
          )}
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

      {/* <1024px 的筛选抽屉。
          **2026-10-27 修**：`FilterSheet` 一直被 import、`sheetOpen` 一直有
          状态、上面那个「筛选」按钮也一直挂着 `aria-controls="tools-filter-sheet"`，
          但这个组件**从来没被渲染过** —— 手机上点「筛选」按钮，`aria-expanded`
          变成 true，屏幕上什么都不会发生，也没有任何报错。实测 390 下
          `#tools-filter-sheet` 不存在、`[role=dialog]` 不存在，而左栏是
          `hidden lg:block`。等于手机端**完全没有筛选功能**，只能靠搜索框。
          这与 `filter-sheet.tsx` 顶部那段「为什么是抽屉」的完整论证正好相反：
          代码写好了，最后一根线没接上。 */}
      <FilterSheet
        open={sheetOpen}
        onClose={closeSheet}
        onClear={reset}
        activeCount={activeFacetCount}
        resultCount={results.length}
      >
        <FacetPanel
          categories={categories}
          tags={tags}
          catCounts={facet.catCounts}
          tagCounts={facet.tagCounts}
          priceOptions={priceOptions}
          platformOptions={platformOptions}
          selected={filter}
          onToggleCategory={toggleCategory}
          onToggleTag={toggleTag}
          onTogglePrice={togglePrice}
          onTogglePlatform={togglePlatform}
        />
      </FilterSheet>
    </div>
  );
}
