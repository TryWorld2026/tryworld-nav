/**
 * 资讯 ↔ 工具 的站内互链。
 *
 * 为什么需要：审计发现资讯频道的五个分区正文里**工具链接 0 个、分类链接 0 个**
 * （work/analysis-ia.md §7），而工具详情页也没有「相关资讯」。读资讯的人
 * 看到「某模型发布」，没有任何路径回到「你们站收录了它吗」；找工具的人
 * 也看不到站内有资讯 —— 结构上把同一个站固化成两个产品。
 *
 * 匹配策略：**工具名在资讯标题/摘要里的最长子串命中**。
 *
 *   为什么不用关键词/向量：工具名是站内唯一权威标识（2081 个 slug），用它
 *   匹配的结果可以被用户一眼验证（「这条新闻里确实提到了 Cursor」），错了也
 *   看得见。关键词匹配会给出「因为都提到 AI」这种不可解释的关系。
 *
 * 三条净化规则，都是为了压掉误报：
 *   1. 工具名去空格后长度 < 2 的不要（如「X」「AI」会把所有新闻都命中）；
 *   2. 命中位置必须不是更长工具名的一部分（「Kimi」不能抢「Kimi PPT助手」）；
 *   3. 单条资讯最多挂 3 个工具，按名称长度倒序（长的更具体）。
 *
 * 全部在构建期算好（server component 调用），客户端不参与。
 */
import { tools } from './data';
import type { NewsItem } from './types';

/** 泛词表：这些词做工具名会在几乎所有资讯里误命中。 */
const STOP_TOOLS = new Set([
  'ai',
  'x',
  'gpt',
  'chatgpt',
  'kimi',
  '豆包',
  '即梦',
  '可灵',
  '元宝',
  '文心',
  '通义',
  '混元',
  '星火',
  '智谱',
  '零一',
  '百川',
]);

/**
 * 三条额外净化规则（实测误报逼出来的）：
 *
 *   1. **纯英文名至少 4 个字符**。3 个字符的英文名在英文新闻里几乎必然误命中：
 *      实测「Dia」命中了 NVIDIA、「Rev」命中了 Anthropic 的 Revolution。
 *   2. **纯英文名必须词边界匹配**。`claude` 不能命中 `clauded`。
 *   3. **中文名按子串**：中文没有词边界，且 2 字名的误报率可接受（「可灵」
 *      命中「可灵 Kling 4.0 上线」正是我们要的）。
 */
function isAsciiKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9.\-_ ]*$/i.test(key);
}

type Candidate = { slug: string; name: string; key: string };

/** 预筛候选：只保留「名字足够具体」的工具。 */
const CANDIDATES: Candidate[] = (() => {
  const out: Candidate[] = [];
  for (const t of tools) {
    const key = (t.name ?? '').replace(/\s+/g, '').toLowerCase();
    if (key.length < 2) continue;
    if (STOP_TOOLS.has(key)) continue;
    if (isAsciiKey(key) && key.length < 4) continue;
    out.push({ slug: t.slug, name: t.name, key });
  }
  // 长名在前，短名靠后：这样「Kimi PPT助手」优先于「Kimi」。
  out.sort((a, b) => b.key.length - a.key.length || (a.slug < b.slug ? -1 : 1));
  return out;
})();

/**
 * 为一条资讯找站内工具。
 *
 * 返回按「名称长度倒序」的最多 3 个 slug。调用方据此渲染 chip。
 */
export function matchToolsForNews(item: NewsItem, limit = 3): string[] {
  const hay = `${item.title ?? ''} ${item.summary ?? ''}`.replace(/\s+/g, ' ').toLowerCase();
  if (!hay) return [];

  const hits: { slug: string; len: number }[] = [];
  const claimed: { start: number; end: number }[] = [];

  for (const c of CANDIDATES) {
    const at = hay.indexOf(c.key);
    if (at < 0) continue;

    // 纯英文名要求词边界，避免 `claude` 命中 `clauded`、`muse` 命中 `museum`。
    if (isAsciiKey(c.key)) {
      const before = at === 0 ? '' : hay[at - 1];
      const after = hay[at + c.key.length] ?? '';
      const boundary = (ch: string) => !ch || !/[a-z0-9]/.test(ch);
      if (!boundary(before) || !boundary(after)) continue;
    }

    // 更长工具名已占据这段区间 → 跳过（避免短名抢长名）。
    const end = at + c.key.length;
    if (claimed.some((r) => at >= r.start && end <= r.end)) continue;

    hits.push({ slug: c.slug, len: c.key.length });
    claimed.push({ start: at, end });
    if (hits.length >= limit) break;
  }

  return hits.map((h) => h.slug);
}

/** 批量版本：`{ [newsId]: slug[] }`，给 `NewsFeed` 当 props 下发。 */
export function newsToolLinks(items: NewsItem[], limit = 3): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const it of items) {
    const slugs = matchToolsForNews(it, limit);
    if (slugs.length > 0) out[it.id] = slugs;
  }
  return out;
}

/**
 * 按资讯对象缓存匹配结果。
 *
 * `newsForTool` 会被每个工具详情页调用一次，而它内部要为每条资讯重扫约 2000
 * 个候选工具名。2081 个页面 × 124 条资讯 × 2000 次 `indexOf` ≈ 5 亿次，
 * 全部是同一批数据的重复计算。构建进程里 `newsItems` 的对象身份是稳定的
 * （同一个模块实例），所以用 `WeakMap` 只算一次即可，行为完全不变。
 */
const toolsOfCache = new WeakMap<NewsItem, string[]>();

function toolsOf(item: NewsItem): string[] {
  let hit = toolsOfCache.get(item);
  if (!hit) {
    hit = matchToolsForNews(item, 10);
    toolsOfCache.set(item, hit);
  }
  return hit;
}

/**
 * 反向：某个工具在最近资讯里被提到的情况（工具详情页的「相关资讯」）。
 * 只扫传入的条目，不做全文检索 —— 静态站没有服务端。
 */
export function newsForTool(slug: string, items: NewsItem[], limit = 3): NewsItem[] {
  const out: NewsItem[] = [];
  for (const it of items) {
    if (toolsOf(it).includes(slug)) out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}
