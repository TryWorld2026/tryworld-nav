/**
 * 客户端判断数据 —— 「怎么选」在浏览器侧的唯一入口。
 *
 * 数据由 `scripts/gen-verdict-index.mjs` 从 `src/lib/tool-verdicts.ts`
 * 生成到 `data/verdict-index.json`（363 条，约 210 KB / br 后约 55 KB）。
 * 为什么不让客户端直接 import 那个 TS 模块：它是服务端常量表，直接 import
 * 会把 3000 行源码打进 bundle；而 `@/lib/data` 更不可能（14 MB 正文）。
 *
 * 只有两条路由会加载这份数据：`/decide`（帮我选）与 `/favorites`（我的工具栈）。
 * 其余页面继续走服务端的 `tool-verdicts.ts`，一个字都不多付。
 *
 * **这不是「推荐算法」的数据**：这里只有人工写下的判断原文、价格与平台事实。
 * 任何打分/排序都必须在调用方**可解释**（见 `lib/decide.ts` 的注释），
 * 不允许用这份数据生成「适合你」这类没有出处的结论。
 */
import raw from '../../data/verdict-index.json';
import type { PriceCode } from './search';

export type VerdictPrice = {
  /** 免费额度描述（原文）。 */
  free?: string;
  /** 起价数字；没有明确起价的条目这里为空（不要填 0）。 */
  from?: number;
  currency?: 'CNY' | 'USD';
  period?: '月' | '年' | '次';
  /** 该条价格事实的核对日期（`YYYY-MM-DD`，北京时间）。 */
  checkedAt: string;
};

/** 一条「怎么选」判断 + 卡片需要的事实。 */
export type VerdictEntry = {
  name: string;
  /** 站内相对路径，渲染前要过 `asset()`。 */
  icon: string;
  /** 分类 slug（一个工具可能属于多个分类）。 */
  cats: string[];
  /** 编辑标签（大厂出品 / 编辑推荐 / 新兴初创…）。 */
  tags: string[];
  price: PriceCode;
  platforms: string[];
  /** 更新时间，Unix **日序**（与索引一致，不是毫秒）。 */
  updated?: number;
  bestFor: string[];
  notFor: string[];
  /** 与最常被一起比较的那个工具的差异，一句话。 */
  diff?: string;
  /** `diff` 对应的对比对象（`/compare` 才有页面）。 */
  vs?: string;
  verdictPrice?: VerdictPrice;
  confidence: 'editor' | 'sourced';
  /**
   * 目录序号（`tools.json` 的原始顺序 / 2081）。
   *
   * 这是「同类里的排位」唯一可用的客观依据 —— 站内没有评分、没有装机量，
   * 只有抓取时就固定的目录顺序。任何排序都必须把它明说成「目录排位」，
   * 不能包装成「热度」或「评分」。
   */
  order: number;
};

type Wire = {
  v: number;
  /** 全部条目里最新的核对日期 —— 全站「判断新鲜度」的唯一参照点。 */
  generatedAt: string;
  source: string;
  count: number;
  items: Record<string, VerdictEntry>;
};

const wire = raw as Wire;

if (!wire || wire.v !== 1) {
  throw new Error('verdict-index 需要 v:1 的 wire 格式，跑 npm run gen:verdicts 重新生成');
}

/** slug → 判断。顺序 = `tool-verdicts.ts` 的书写顺序（分类分组）。 */
export const VERDICTS_BY_SLUG: Record<string, VerdictEntry> = wire.items;

/** 判断条数（用于「363 条里有几条和你相关」这类口径）。 */
export const VERDICT_COUNT: number = wire.count;

/** 判断层的数据口径：最新核对日期 + 来源文件。 */
export const VERDICT_BASIS = {
  generatedAt: wire.generatedAt,
  source: wire.source,
} as const;

/** slug → 判断；没有写过判断的工具返回 `undefined`（调用方据此降级）。 */
export function verdictOf(slug: string): VerdictEntry | undefined {
  return VERDICTS_BY_SLUG[slug];
}
