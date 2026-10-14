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
  NewsArticle,
  Tool,
  ToolExtras,
} from './types';
import { asset, assetList } from './assets';

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
 * one of the 1150 catalogued slugs has an entry today, but the accessor stays
 * defensive: the JSON is crawler output, and a half-written entry should degrade
 * one page rather than throw during prerender and take the build down.
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
 * AI新闻 articles, newest first. The origin's index is emitted in its own
 * (newest-first) order by the payload walk, so the harvest preserved it; sorting
 * here only guards against a re-run producing a different order. The dates are
 * the origin's `dateTime` values, all ISO-8601 UTC.
 */
export const newsArticles: NewsArticle[] = (rawNews as NewsArticle[])
  .slice()
  .sort((a, b) => (a.dateTime < b.dateTime ? 1 : a.dateTime > b.dateTime ? -1 : 0))
  .map((a) => ({ ...a, image: asset(a.image), cover: asset(a.cover) }));

export const newsBySlug = new Map(newsArticles.map((a) => [a.slug, a]));

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

export function searchTools(query: string, limit = 40): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { tool: Tool; score: number }[] = [];
  for (const t of tools) {
    // Read defensively: this runs in the search palette, which every page
    // mounts, so one malformed catalog entry would break search everywhere
    // instead of just failing to match that one tool.
    const name = (t.name ?? '').toLowerCase();
    const description = (t.description ?? '').toLowerCase();
    const cats = t.categories ?? [];
    const tagNames = t.tags ?? [];
    let score = -1;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (description.includes(q)) score = 30;
    else if (cats.some((c) => (c.name ?? '').toLowerCase().includes(q))) score = 20;
    else if (tagNames.some((g) => g.toLowerCase().includes(q))) score = 10;
    if (score > 0) scored.push({ tool: t, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.tool);
}

/**
 * 站点自身的品牌常量。改这里就是改全站的站名、域名与 SEO 文案——它喂给
 * layout 的 metadata、sitemap、robots.txt 以及各路由的 generateMetadata。
 *
 * 品牌取面试界 TryWorld（`~/.claude/skills/tryworld-brand`，v1.4.0）。站名是
 * 「主品牌 + 品类后缀」的形式，`name` 与 `url` 是唯一事实来源。
 *
 * 注意：`title` 与 `description` 里的品类句式（「探索发现热门的智能体和AI工具」）
 * 沿用了原站 hero 的措辞。这是站点自身的文案，不是抓取内容，若日后要彻底脱离
 * 原站行文，从这两条和 `hero.tsx` 的 HERO_LEAD 改起。
 */
export const SITE = {
  name: '试界导航',
  url: 'https://nav.tryworld.com.cn',
  title: '试界导航 - 探索发现热门的智能体和AI工具',
  description:
    '试界导航是专注于智能体和AI工具的门户网站，我们致力于为用户介绍最新、热门的智能体和AI工具，帮助用户快速找到适合自己的学习、工作、生活的AI利器。',
  keywords: [
    '试界导航',
    '试界导航官网',
    'tryworld.com.cn',
    '试界',
    'TryWorld',
    '智能体',
    'AI工具',
    'AI导航',
    'AI工具导航',
    'AI工具推荐',
    '智能体导航',
    '智能体大全',
  ],
  ogImage: asset('/assets/site/og.png'),
};
