/**
 * 卡片排序与新鲜度文案 —— **纯函数、零 import**。
 *
 * 为什么从 `card.ts` 拆出来：`card.ts` 要 import `./assets` 与 `./nav`
 * （前者读 `NEXT_PUBLIC_ASSET_BASE`，后者读 `data/nav.json`），而 Node 的原生
 * TS 解析（`node --test tests/card.test.mjs` 直接 import 源码）**要求相对
 * import 带扩展名**，而 TSC 的 `moduleResolution: bundler` 又不接受 `.ts`
 * 后缀。两边都要成立，唯一的做法是让被测试的那个文件零 import。
 *
 * 这与 `lib/search.ts` 顶部那段说明是同一条约束 —— 那个文件也是为此保持
 * 零 import 的。
 */

/** 卡片排序/新鲜度只需要的三个字段。`CardTool` 结构上满足它。 */
export type SortableCard = {
  name: string;
  /** 更新时间，Unix **日序**。未采集到则缺失。 */
  updated?: number;
};

/**
 * 卡片排序 —— 与 `search.ts` 的 `sortRecords()` **同一套语义**，但作用于
 * 卡片（`CardTool` / `SortableCard`）。
 *
 * 为什么不直接复用 `sortRecords()`：它要 `SearchRecord[]`（含
 * `s/n/d/i/c/t/p/pl/w/o` 九个字段），而分类页手里只有卡片（五六个字段）。
 * 为了借一个排序函数去伪造九个字段的假记录，比这十行代码更糟 —— 而且那种
 * 假记录一旦被别的函数读到（比如 `filterRecords` 看 `p`），就会以
 * 「看起来像真数据」的方式出错。
 *
 * 语义（与 `sortRecords` 逐条对齐，改一处必须同步另一处；`tests/card.test.mjs`
 * 有一条用例把两者在真实数据上的顺序逐项比对）：
 *   `''`        目录顺序（`tools.json` 的原站手调顺序），调用方保持原数组即可
 *   `'updated'` 更新时间新→旧；**未采集到时间的稳定置后**，不与真实时间抢位
 *   `'name'`    `zh-CN` 数字感知 collator
 *
 * 不原地修改入参（`sort` 是原地排序，所以先 `map` 出带下标的副本）。
 */
export function sortCards<T extends SortableCard>(
  cards: T[],
  sort: '' | 'updated' | 'name',
): T[] {
  if (sort === 'updated') {
    return cards
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const ua = typeof a.c.updated === 'number' ? a.c.updated : -1;
        const ub = typeof b.c.updated === 'number' ? b.c.updated : -1;
        if (ua !== ub) return ub - ua;
        return a.i - b.i;
      })
      .map((x) => x.c);
  }
  if (sort === 'name') {
    const collator = new Intl.Collator('zh-CN', { numeric: true });
    return cards
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const d = collator.compare(a.c.name, b.c.name);
        return d !== 0 ? d : a.i - b.i;
      })
      .map((x) => x.c);
  }
  return cards;
}

/** 距今（数据快照）多少天以内算「近期更新」。超过就不再提，避免把陈旧当卖点。 */
export const FRESH_DAYS = 90;

/**
 * 卡片上的新鲜度短语。**只在真的新鲜时**返回非空。
 *
 * `epoch` 是全站新鲜度的参照点，由调用方传入（`catalog-index.ts` 的
 * `DATA_EPOCH`）—— 不在这里读 `Date.now()`，理由见那里的注释：纯静态导出
 * 要求「没改内容就一个字节不变」（部署从 51 分钟压到 24 秒），渲染期读墙钟
 * 会让「3 天前更新」每天变一次，等于每天全量重传一次站点。
 *
 * 阈值 90 天是刻意的：2081 条里 `updated` 中位 371 天、88.75% 超一年、
 * 只有个位数在 30 天内。把「更新于 2025-10-11」印在每一张卡上，等于用一句
 * 陈旧信息占据卡片最贵的一行，读者会以为整站都在维护 —— 而事实相反。
 * 所以这里**有则说、陈旧则不说**，由详情页用完整正文承担「它还能不能用」。
 */
export function freshLabel(day: number | undefined, epoch: number | undefined): string {
  if (typeof day !== 'number' || typeof epoch !== 'number') return '';
  const ago = epoch - day;
  if (ago > FRESH_DAYS) return '';
  if (ago <= 0) return '近期更新';
  if (ago <= 7) return `${ago} 天前更新`;
  if (ago <= 30) return `${Math.floor(ago / 7)} 周前更新`;
  return `${Math.floor(ago / 30)} 个月前更新`;
}
