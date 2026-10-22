/**
 * 卡片数据的**服务端**取值 —— 把 `tool-extras.json` 里的价格与更新时间
 * 映射成 `CardTool` 需要的那两个字段。
 *
 * 为什么单独一个模块：`pricing` 与 `updated` 都在 14 MB 的 `tool-extras.json`
 * 里，只有服务端能读。而 `CardTool` 本身必须能被 `'use client'` 组件引用，
 * 所以类型放在 `card.ts`（客户端安全），取值放在这里（server-only）。
 *
 * 2081 次查表在构建期跑一遍，成本可以忽略；运行时这两个函数只被服务端组件
 * 调用，不进 bundle。
 */
import { extrasBySlug } from './data';
import type { CardTool } from './card';
import { priceCodeFromLabel } from './pricing';
import type { Tool } from './types';

/**
 * `Tool` → `CardTool`，并把价格档位与更新时间补上。
 *
 * `updated` 的清洗（`'2026-08-22 06:17:19.986Z'` 里的空格要换成 `T`）与
 * `scripts/generate-search-index.mjs` 的 `unixDayOf()` **必须完全一致**，
 * 否则同一条工具在服务端页面与 `/tools` 里会显示成不同的日期。
 */
export function cardFromTool(tool: Tool): CardTool {
  const extras = extrasBySlug(tool.slug);
  return {
    slug: tool.slug,
    name: tool.name,
    description: tool.description,
    icon: tool.icon,
    tags: tool.tags ?? [],
    categories: (tool.categories ?? []).map((c) => ({
      slug: c.slug,
      name: c.name,
      color: c.color,
    })),
    price: priceCodeFromLabel(extras?.pricing),
    updated: unixDayOf(extras?.updated),
    platforms: (extras?.platforms ?? []).map((p) => p.name),
  };
}

/** `'2026-08-22 06:17:19.986Z'` → Unix 日序；无法解析时 `undefined`（绝不写「未知」）。 */
export function unixDayOf(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  const ms = Date.parse(raw.replace(' ', 'T'));
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 86_400_000);
}
