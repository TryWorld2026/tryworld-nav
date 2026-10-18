import rawTools from '../../data/tools.json';
import rawCategories from '../../data/categories.json';
import rawSections from '../../data/sections.json';
import rawFeatured from '../../data/featured.json';
import rawFriendLinks from '../../data/friend-links.json';
import rawExtras from '../../data/tool-extras.json';
import rawLatest from '../../data/latest-additions.json';
import rawCollections from '../../data/collections.json';
import rawNews from '../../data/news.json';
import rawHomeRails from '../../data/home-rails.json';
import rawCategoryOrder from '../../data/category-order.json';
import rawCategoryCards from '../../data/category-cards.json';
import type {
  Category,
  Collection,
  Featured,
  NewsItem,
  Tool,
  ToolExtras,
} from './types';
import { asset, assetList } from './assets';
import rawSearchIndex from '../../data/search-index.json';
import { searchIndex, type SearchRecord } from './search';

export const tools = (rawTools as Tool[]).map((t) => ({
  ...t,
  icon: asset(t.icon),
  image: asset(t.image),
}));
export const categories = rawCategories as Category[];
export const collections = (rawCollections as Collection[]).map((c) => ({
  ...c,
  icon: asset(c.icon),
  tagIcon: asset(c.tagIcon),
  memberIcons: assetList(c.memberIcons),
  tools: c.tools.map((t) => ({ ...t, icon: asset(t.icon), image: asset(t.image) })),
}));
export const collectionBySlug = new Map(collections.map((c) => [c.slug, c]));
export const toolBySlug = new Map(tools.map((t) => [t.slug, t]));
export const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

/**
 * 客户端搜索索引（由 `scripts/generate-search-index.mjs` 生成）。
 *
 * 它**只交给客户端**（命令面板与 `/tools` 的筛选器），服务端不需要它 ——
 * 服务端的搜索只在 `searchTools()` 里用到，而那个函数本身就是给 `/tools`
 * 预渲染时算初始列表用的。这份数据 329 KB raw / 59 KB br，是「搜索能接住
 * 任务语」的代价，比原先被打进 layout chunk 的 1.4 MB 目录 JSON 便宜得多。
 */
export const searchIndexRecords = rawSearchIndex as SearchRecord[];

// Re-exported so server components keep their single `@/lib/data` import; the
// client-side consumer (`ToolMiniCard`) imports `@/lib/tags` directly instead,
// which keeps this 7 MB module out of the browser bundle. See lib/tags.ts.
export { tags, tagByName } from './tags';

/**
 * Tool-page copy and metadata keyed by slug. Only server components read this,
 * so the ~7 MB of prose and inline SVG never reaches the client bundle — it is
 * baked into each prerendered page's HTML instead. Module-private: nothing
 * outside this file has any business reaching past `extrasBySlug`.
 */
const toolExtras = rawExtras as Record<string, ToolExtras>;

/**
 * Harvested extras for one tool, or `null` when the origin published none. Every
 * one of the 2081 catalogued slugs has an entry today, but the accessor stays
 * defensive: the JSON is crawler output, and a half-written entry should degrade
 * one page rather than throw during prerender and take the build down. Note
 * that a missing `prose` also reads as `null` here — `pokecut` is the one
 * slug whose origin page ships an empty body, and `ToolProse` renders nothing
 * for it.
 */
export function extrasBySlug(slug: string): ToolExtras | null {
  const extras = toolExtras[slug];
  if (!extras || typeof extras.prose !== 'string') return null;
  return extras;
}

/**
 * Featured picks normally resolve to their own detail page, but a few entries
 * (e.g. LibTV) are harvested products that never made it into the tool
 * catalog, so /tools/{slug} would 404 — those fall back to their external site.
 */
export const featured = (rawFeatured as Omit<Featured, 'href'>[]).map((t) => ({
  ...t,
  icon: asset(t.icon),
  image: asset(t.image),
  href: toolBySlug.has(t.slug) ? `/tools/${t.slug}` : (t.external ?? `/tools/${t.slug}`),
}));

export const friendLinks = rawFriendLinks as { name: string; href: string }[];

export const sections = (rawSections as {
  slug: string;
  name: string;
  icon: string;
  color: string;
  tools: Tool[];
}[]).map((s) => ({
  ...s,
  icon: asset(s.icon),
  tools: s.tools.map((t) => ({ ...t, icon: asset(t.icon), image: asset(t.image) })),
}));

export const hotCategories = categories.filter((c) => c.hot);
export const allCategories = categories;

/**
 * AIHOT 资讯，最新在前。
 *
 * `data/news.json` 由 `scripts/fetch-aihot.mjs` 在构建前生成（`npm run build`
 * 的第一步），抓的是 AIHOT 最近 7 天的精选条目。这里再排一次序只是防御：
 * 脚本已经排好，但数据文件是外部产物，顺序不该由渲染层假定。
 *
 * 与工具数据不同，这里**没有** `asset()` 映射：AIHOT 不提供配图，卡片是纯文字，
 * 所以不存在需要解析的 `/assets/...` 路径。
 */
export const newsItems: NewsItem[] = (rawNews as NewsItem[])
  .slice()
  .sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));

/**
 * The tools in one category, in the origin's own order.
 *
 * The origin's category pages are not alphabetical, not by date and not by the
 * catalog's own order — they are a hand-tuned ranking. Harvested per category
 * into `data/category-order.json`; tools the origin's list does not name (a
 * catalog entry it ranks nowhere) sort to the end in catalog order rather than
 * disappearing.
 */
const categoryOrder = rawCategoryOrder as Record<string, string[]>;

/**
 * The /categories index cards. Held as its own file because the taglines, the
 * six curated member avatars per card and the `+N` overflow counts are all
 * harvested facts about the origin's page rather than derivations from the
 * catalog — see the note on the page.
 */
export const categoryCards = (rawCategoryCards as {
  slug: string;
  name: string;
  tagline: string;
  color: string;
  icon: string;
  plus: number;
  members: { slug: string; icon: string; name: string }[];
}[]).map((c) => ({
  ...c,
  members: c.members.map((m) => ({ ...m, icon: asset(m.icon) })),
}));

export function toolsByCategory(slug: string): Tool[] {
  const inCat = tools.filter((t) => t.categories.some((c) => c.slug === slug));
  const rank = categoryOrder[slug];
  if (!rank) return inCat;
  const pos = new Map(rank.map((s, i) => [s, i]));
  return inCat
    .map((t, i) => [t, pos.get(t.slug) ?? rank.length + i] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([t]) => t);
}

/**
 * FNV-1a over a string, as an unsigned 32-bit int. Small, dependency-free and
 * stable across runs and platforms — the whole point, since these hashes seed
 * the widget orderings below and must not shift between builds.
 */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic Fisher-Yates over a copy of `items`, driven by `seed`. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * The origin's 更多AI工具 grid is a random sample of the catalog, re-rolled on
 * every render — one SSR fetch of the doubao page returned 12 cards while the
 * RSC payload for the same request held 18. A replica cannot reproduce a random
 * sample, and should not try: the deviation is that the ordering here is a
 * pure function of the slug, so a given tool page always shows the same grid.
 */
export function moreTools(slug: string, count = 18): Tool[] {
  const seed = hash32(`more:${slug}`);
  return seededShuffle(
    tools.filter((t) => t.slug !== slug),
    seed,
  ).slice(0, count);
}

/**
 * 类似工具 — the origin's version is random too, but its picks are clearly
 * drawn from the tool's own categories (doubao's included several other chat
 * assistants), so this one keeps that relationship and only makes the choice
 * deterministic. A category with fewer than `count` members is topped up from
 * the rest of the catalog so the rail panel is never half-empty.
 */
export function relatedTools(slug: string, count = 10): Tool[] {
  const tool = toolBySlug.get(slug);
  if (!tool) return [];
  const own = new Set((tool.categories ?? []).map((c) => c.slug));
  const same: Tool[] = [];
  const others: Tool[] = [];
  for (const t of tools) {
    if (t.slug === slug) continue;
    if ((t.categories ?? []).some((c) => own.has(c.slug))) same.push(t);
    else others.push(t);
  }
  const seed = hash32(`related:${slug}`);
  const ordered = [
    ...seededShuffle(same, seed),
    ...seededShuffle(others, seed ^ 0x9e3779b9),
  ];
  return ordered.slice(0, count);
}

/**
 * The home page's two rails, harvested in the origin's own order. Both are
 * hand-picked lists rather than a slice of the catalog — 热门工具 is 10 and
 * 最新添加 is 25 — so neither is derivable from `tools.json`.
 */
const homeRails = rawHomeRails as { hot: string[]; newest: string[] };

function resolveSlugs(slugs: string[]): Tool[] {
  const out: Tool[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    const tool = toolBySlug.get(slug);
    if (!tool || seen.has(slug)) continue;
    seen.add(slug);
    out.push(tool);
  }
  return out;
}

export const hotTools = resolveSlugs(homeRails.hot);
export const newestTools = resolveSlugs(homeRails.newest);

/**
 * 最新收录 — the origin publishes a fixed list of 20, in order, on every tool
 * page. Harvested verbatim into `data/latest-additions.json`; resolved here so
 * a slug that ever drops out of the catalog degrades to a shorter list instead
 * of a broken link.
 */
export const latestAdditions: Tool[] = (() => {
  const slugs = (rawLatest as { slugs?: string[] }).slugs ?? [];
  return resolveSlugs(slugs);
})();

/**
 * 搜索 —— 委托给 `lib/search.ts` 的纯函数实现。
 *
 * 原实现（2026-10-18 之前）是纯小写子串匹配，实测 22 个真实意图词里 6 个
 * 在 Ctrl+K 与 `/tools` 两处都 0 命中；索引 prose 后 22/22 都能召回。
 * 现在走同一份 `data/search-index.json`（含正文里挖出来的任务词），
 * 客户端面板与服务端调用得到完全一致的结果。
 *
 * 保留这个导出的理由：`/tools` 的服务端筛选与任何未来的服务端调用点都要一个
 * 「给字符串、拿 Tool[]」的入口，而 `search.ts` 返回的是 hit（slug + 分数）。
 */
export function searchTools(query: string, limit = 40): Tool[] {
  const hits = searchIndex(searchIndexRecords, query, limit);
  return hits.map((h) => toolBySlug.get(h.slug)).filter((t): t is Tool => Boolean(t));
}

/**
 * 站点自身的品牌常量 —— 现在住在 `lib/site.ts`（客户端安全）。
 *
 * 这里继续 re-export，是为了让 `layout.tsx` / `manifest.ts` / `robots.txt`
 * 等 15 处既有 `from '@/lib/data'` 的 import 一行都不用改。真正的理由是
 * 客户端组件（页脚、侧栏）只要站名，不该为此拖进 1.4 MB 目录 JSON ——
 * 见 `lib/site.ts` 顶部的说明。
 */
export { SITE } from './site';

