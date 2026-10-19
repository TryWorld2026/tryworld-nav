/**
 * 新闻卡片的时间展示。
 *
 * AIHOT 的 `publishedAt` 是 ISO-8601 UTC，而读者在中国。直接切字符串
 * （`publishedAt.slice(0, 10)`）会得到 UTC 日期：一条 `2026-10-15T11:00:00Z`
 * 的条目在北京是 10-15 19:00，看着没错；但 `2026-10-14T18:00:00Z` 在北京已经是
 * 10-15 02:00，切出来就少了一天。所以一律走 `Intl` 按 `Asia/Shanghai` 格式化。
 *
 * 这里**不使用** `new Date().getTime()` 之外的运行时状态——`relativeLabel` 的
 * 「今天/昨天」是相对**构建时刻**算的。静态站没有请求时间，页面在构建时就定格了，
 * 所以这个「今天」指的是构建那天。卡片上因此始终同时给出绝对日期，避免隔夜后
 * 出现「今天」实际是前天这种误导。
 */

import type { NewsItem } from './types';

const TZ = 'Asia/Shanghai';

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** `2026年10月15日`；无法解析时回退成空串而不是 `Invalid Date`。 */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? dateFmt.format(d) : '';
}

/** `2026年10月15日 19:00` —— 详情与 `<time>` 的 title 用。 */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? dateTimeFmt.format(d) : '';
}

/**
 * `2026/10/15`，卡片的紧凑日期。
 *
 * 手写而不是再建一个 `Intl`：`zh-CN` 的 numeric 格式会给出 `2026/10/15`，
 * 但不同 Node/ICU 版本对分隔符与补零的处理有差异，而这里要的是稳定输出。
 * 取值本身仍走 `Intl`（见 `shanghaiParts`），所以时区换算是对的。
 */
export function formatDateShort(iso: string | null | undefined): string {
  const p = shanghaiParts(iso);
  return p ? `${p.year}/${p.month}/${p.day}` : '';
}

/**
 * 相对构建时刻的粗粒度标签：`今天` / `昨天` / `3 天前`。
 * 超过 7 天返回空串——资讯卡片不需要「上个月」这种冗余，绝对日期已经给了。
 */
export function relativeLabel(iso: string | null | undefined, now: Date = new Date()): string {
  return relativeLabelAt(iso, now);
}

/**
 * `relativeLabel` 的显式「现在」版本。
 *
 * 为什么要拆出这一层：默认参数 `new Date()` 在**服务端预渲染**与**客户端水合**
 * 时各求值一次，跨过午夜就会给出不同的字符串，于是 React 报 #418（文本不匹配）
 * 并丢弃整棵服务端 DOM 重渲染 —— 部署后第 2 天起每次访问 `/news` 都会触发。
 *
 * 纯函数本身没错，错的是「谁是 now」由调用时机决定。所以客户端组件一律走这个
 * 显式版本，由 `NewsFeed` 传入一个**服务端与首次水合都相同**的时间（构建时刻），
 * 挂载后再升级成真实的当前时间。
 */
export function relativeLabelAt(
  iso: string | null | undefined,
  now: Date,
): string {
  const d = parse(iso);
  if (!d) return '';
  const a = shanghaiParts(d);
  const b = shanghaiParts(now);
  if (!a || !b) return '';

  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  const diff = Math.round((dayB - dayA) / 86_400_000);

  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff <= 7) return `${diff} 天前`;
  return '';
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 取一个时刻在北京时间下的年月日，用 `en-CA` 的 ISO 形输出避免再解析文本。 */
function shanghaiParts(input: string | Date | null | undefined) {
  const d = typeof input === 'string' || input === null || input === undefined ? parse(input) : input;
  if (!d || Number.isNaN(d.getTime())) return null;
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}

/* ------------------------------------------------------------------ *
 * 以下为 /news 资讯模块的纯函数层。                                    *
 *                                                                     *
 * 它们全部只依赖 `NewsItem` 数组，不碰 React、不碰 window，所以能在      *
 * `tests/news.test.mjs` 里用 `node --test` 直接 import 这个 .ts 文件      *
 * 跑（Node 24 的类型剥离）。组件 `news-feed.tsx` 只负责渲染与状态。      *
 * ------------------------------------------------------------------ */

/** 一周七天，下标取自 `Date.UTC(...).getUTCDay()`，不依赖 ICU 的本地化输出。 */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/**
 * 分类 -> 品牌取色。AIHOT v1 只有六个分类，全部落在试界色板内：
 *
 *   AI 产品   #24564E  brand green       AI 模型   #1B2523  brand ink
 *   行业动态  #B54826  brand smallAccent 教程      #F2693C  brand orange
 *   论文      #616A63  brand muted       观点      #4A7A6F  green 的浅一档
 *
 * 「观点」刻意用品牌绿的浅档而不是引入第七个色相：色板只有五个色，六个分类
 * 必然有一档是派生色，而同色相的深浅差在扫读时仍然可分，也不会像第七个色相
 * 那样把页面拉向彩虹。**禁紫色**（试界品牌无紫，原站 prose 里的 #8b5cf6 是
 * 历史遗留，新 UI 不再使用）。
 *
 * `bar` 是卡片左侧 2px 色条，`text` 是徽章文字，`wash` 是徽章底色。
 */
const NEWS_TONES: Record<string, { bar: string; text: string; wash: string }> = {
  'ai-products': { bar: '#24564E', text: '#24564E', wash: 'rgba(36, 86, 78, 0.10)' },
  'ai-models': { bar: '#1B2523', text: '#1B2523', wash: 'rgba(27, 37, 35, 0.08)' },
  industry: { bar: '#B54826', text: '#B54826', wash: 'rgba(181, 72, 38, 0.10)' },
  tip: { bar: '#F2693C', text: '#C14A22', wash: 'rgba(242, 105, 60, 0.12)' },
  paper: { bar: '#616A63', text: '#616A63', wash: 'rgba(97, 106, 99, 0.12)' },
  opinion: { bar: '#4A7A6F', text: '#3F6B60', wash: 'rgba(74, 122, 111, 0.12)' },
};

/** `category` 为 null 时的回退色——用 brand muted，不抢已着色分类的注意力。 */
const FALLBACK_TONE = { bar: '#D3D5CB', text: '#616A63', wash: 'rgba(97, 106, 99, 0.10)' };

/** 分类色；未知 slug 与 null 一律回退到 `FALLBACK_TONE`。 */
export function categoryTone(category: string | null | undefined): {
  bar: string;
  text: string;
  wash: string;
} {
  if (!category) return FALLBACK_TONE;
  return NEWS_TONES[category] ?? FALLBACK_TONE;
}

/**
 * 一条资讯在北京时间下的日期键 `2026-10-16`；无法解析时返回空串。
 *
 * 空串是**有意的**哨兵值：`groupByDay` 用它把时间未知的条目归到最后一组，
 * 而不是丢掉。
 */
export function dayKey(iso: string | Date | null | undefined): string {
  // 参数故意放宽到 `Date`：`dayBucketLabel(key, now)` / `inRange(item, range, now)`
  // 内部要把「当前时刻」折成同一天的日期键，调用点天然持有 `Date` 而不是 ISO 串。
  const p = shanghaiParts(iso);
  if (!p) return '';
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

/** `dateKey` 那天的星期，`周三` 这种两字形式；空键返回空串。 */
export function weekdayOf(key: string): string {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return '';
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 两个日期键相差几天（`b - a`），任一为空键返回 `NaN`。 */
function dayGap(a: string, b: string): number {
  if (!a || !b) return NaN;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

/**
 * 按北京时间把条目分到「今天 / 昨天 / 更早」三档。
 *
 * 与 `relativeLabel` 的区别：那个给卡片用，超过 7 天返回空串（卡片已有绝对
 * 日期，不需要「上个月」）；这个给分组头用，必须永远给出一个标签。
 */
export function dayBucketLabel(key: string, now: Date = new Date()): string {
  if (!key) return '时间未知';
  const gap = dayGap(key, dayKey(now));
  if (Number.isNaN(gap)) return '更早';
  if (gap <= 0) return '今天';
  if (gap === 1) return '昨天';
  if (gap <= 7) return `${gap} 天前`;
  return '更早';
}

/** 一条分组：同一天（北京时间）的条目。`items` 已按时间倒序。 */
export type NewsDayGroup = {
  key: string;
  label: string;
  weekday: string;
  items: NewsItem[];
};

/**
 * 按日期分组，组间按日期**倒序**（最新在上），组内顺序原样保留。
 *
 * 调用方传进来的数组应当是已排序的（`lib/data.ts` 的 `newsItems` 已按
 * `publishedAt` 倒序）；这里只分组不重排，所以「谁在最上面」由上游决定，
 * 纯函数不会悄悄改变顺序。
 */
export function groupByDay(items: NewsItem[], now: Date): NewsDayGroup[] {
  const buckets = new Map<string, NewsItem[]>();
  for (const item of items) {
    const key = dayKey(item.publishedAt);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, list]) => ({
      key,
      label: dayBucketLabel(key, now),
      weekday: weekdayOf(key),
      items: list,
    }));
}

/** 一个分类 pill：slug 可能为 null（AIHOT 没给分类的条目）。 */
export type NewsCategoryFacet = {
  /** 用于 React key 与 aria 标识；null 分类归一成 `__none__`。 */
  id: string;
  slug: string | null;
  label: string;
  count: number;
};

/**
 * 分类计数，按条数倒序、同数按中文标签字典序。
 *
 * `categoryLabel` 由抓取脚本映射好，这里不重新推断；`category` 为 null 的
 * 条目单独归到「未分类」。
 */
export function categoryList(items: NewsItem[]): NewsCategoryFacet[] {
  const map = new Map<string, NewsCategoryFacet>();
  for (const item of items) {
    const id = item.category ?? '__none__';
    const label = item.categoryLabel || '未分类';
    const found = map.get(id);
    if (found) found.count += 1;
    else map.set(id, { id, slug: item.category ?? null, label, count: 1 });
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'),
  );
}

/**
 * 关键词搜索，返回**新的倒序数组**（按相关度，同分保持传入顺序）。
 *
 * 权重：标题命中 > 英文原标题 > 摘要 > 来源 > 分类。摘要里出现关键词的相关度
 * 低于标题，因为读者通常是「我看到过这个标题」而不是「我记得某段摘要」。
 * 大小写不敏感（`toLowerCase`），中文不受影响但英文站名与型号受益。
 */
export function searchNews(items: NewsItem[], query: string): NewsItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice();
  const scored: { item: NewsItem; score: number }[] = [];
  for (const item of items) {
    const title = (item.title ?? '').toLowerCase();
    const original = (item.originalTitle ?? '').toLowerCase();
    const summary = (item.summary ?? '').toLowerCase();
    const source = (item.source ?? '').toLowerCase();
    const label = (item.categoryLabel ?? '').toLowerCase();
    let score = -1;
    if (title.startsWith(q)) score = 100;
    else if (title.includes(q)) score = 80;
    else if (original.includes(q)) score = 60;
    else if (summary.includes(q)) score = 40;
    else if (source.includes(q)) score = 30;
    else if (label.includes(q)) score = 20;
    if (score > 0) scored.push({ item, score });
  }
  // Array.prototype.sort 在 V8 里是稳定的，同分条目保持传入（即时间倒序）顺序。
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

/** 时间范围分段控件的四个值。 */
export type NewsRange = 'all' | 'today' | '3d' | '7d';

export const NEWS_RANGES: { id: NewsRange; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'today', label: '今天' },
  { id: '3d', label: '近 3 天' },
  { id: '7d', label: '近 7 天' },
];

/**
 * 条目是否落在某个时间范围内，按**北京时间**的日期差算。
 *
 * 用日期差而不是 24 小时的毫秒差：「今天」对读者的意思是「今天一整天」，
 * `now - 36h` 会把凌晨的条目算成昨天之外，而读者认为它属于今天。
 */
export function inRange(
  item: NewsItem,
  range: NewsRange,
  now: Date = new Date(),
): boolean {
  if (range === 'all') return true;
  const key = dayKey(item.publishedAt);
  if (!key) return false;
  const gap = dayGap(key, dayKey(now));
  if (Number.isNaN(gap)) return false;
  if (range === 'today') return gap <= 0;
  if (range === '3d') return gap <= 3;
  return gap <= 7;
}

/** 一个来源 facet。 */
export type NewsSourceFacet = { name: string; count: number };

/**
 * Top 来源，按条数倒序、同数按名称字典序。`limit` 默认 8 —— 右栏放得下，
 * 也够读者判断「这期的信息浓度集中在哪里」。
 */
export function sourceList(items: NewsItem[], limit = 8): NewsSourceFacet[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const name = item.source || '未知来源';
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit);
}

/** 一个月份归档 facet，`2026-10` 这种键。 */
export type NewsMonthFacet = { key: string; label: string; count: number };

/** 按月归档，倒序。键取自北京时间，与分组口径一致。 */
export function monthList(items: NewsItem[]): NewsMonthFacet[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = dayKey(item.publishedAt).slice(0, 7);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: monthLabel(key), count }))
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

/** `2026-10` -> `2026 年 10 月`；空键返回空串。 */
export function monthLabel(key: string): string {
  if (!key) return '';
  const [y, m] = key.split('-');
  if (!y || !m) return '';
  return `${y} 年 ${Number(m)} 月`;
}
