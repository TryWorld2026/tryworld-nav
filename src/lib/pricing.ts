/**
 * The pricing pill in the tool-page hero — the origin's first chip in the row.
 *
 * The origin hardcodes this as a bare string in the component tree, chosen from a
 * field that appears nowhere in its SSR HTML, its RSC payload, or any API the
 * replica can reach. It is therefore not derivable from anything else we hold:
 * it does not follow the 完全免费 tag (scite-ai and chatgpt both carry no tags
 * at all yet render 免费增值, and midjourney renders 付费), and it is not a
 * function of the entry's own copy. The only faithful recovery is to read it back
 * off every page, which is what `tools/pricing` in the harvest pipeline does.
 *
 * Four tones exist in the corpus, and the census over all 2081 pages is exact:
 * 免费增值 1737, 免费 183, 免费开源 55, 付费 51 — with 53 slugs rendering no
 * badge at all and 2 (`leewow`, `shenbi-maoyan`) carrying a 未知 label that
 * predates the tone table and therefore resolves to the neutral pill. Each
 * entry holds the tone-specific tail of the origin's class list; the shared
 * prefix lives in `PRICING_PREFIX`.
 *
 * A label the harvest never saw falls back to the neutral grey pill rather than
 * being dropped — an unrecognised value should still read as a pricing badge, not
 * silently vanish from the row.
 */
import type { PriceCode } from './search';

/** The origin's class list for every tone, minus the tone-specific colours. */
export const PRICING_PREFIX =
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset';

const TONES = {
  free: {
    label: '免费',
    className:
      'bg-green-50 bg-opacity-50 text-green-700 ring-green-600/20',
  },
  /*
   * 原站的四档用的是 Tailwind 的 purple / yellow 色相。免费增值是**最常见**
   * 的一档（2081 个工具里 1737 个），等于每一页工具详情都挂着一枚紫色胶囊 ——
   * 直接违反试界「禁紫色」的品牌约束（`src/lib/news.ts` 里对资讯分类写过同一条）。
   *
   * 改成品牌绿：绿在试界的语义是「可用/正向」，免费增值本来就是「有免费额度」，
   * 语义也对得上。付费保留暖色，但收到品牌橙的浅档（#B54826 家族），
   * 不再用 Tailwind 的 yellow-700。
   */
  freemium: {
    label: '免费增值',
    className:
      'bg-gongke-accent/[0.07] bg-opacity-50 text-gongke-accent ring-gongke-accent/20',
  },
  paid: {
    label: '付费',
    className:
      'bg-[#F2693C]/10 bg-opacity-50 text-[#B54826] ring-[#B54826]/20',
  },
  open: {
    label: '免费开源',
    className:
      'bg-blue-50 bg-opacity-50 text-blue-700 ring-blue-600/20',
  },
  unknown: {
    label: '',
    className:
      'bg-gray-50 bg-opacity-50 text-gray-700 ring-gray-600/20',
  },
} as const;

export type PricingTone = keyof typeof TONES;

/**
 * The origin's badge label → its tone. Matching is on the label rather than on
 * the harvested class string so a future harvest can key off the visible text
 * alone.
 */
const LABEL_TO_TONE: Record<string, PricingTone> = {
  免费: 'free',
  免费增值: 'freemium',
  付费: 'paid',
  免费开源: 'open',
};

/** Resolve a harvested label to its tone, defaulting to the neutral pill. */
export function pricingTone(label: string | undefined): PricingTone {
  if (!label) return 'unknown';
  return LABEL_TO_TONE[label] ?? 'unknown';
}

/**
 * The full class list for one badge. Returns `null` only when the entry carries
 * no pricing at all, so the caller can drop the chip entirely rather than render
 * an empty pill.
 */
export function pricingBadgeClass(label: string | undefined): string | null {
  if (!label) return null;
  const tone = TONES[pricingTone(label)];
  return `${PRICING_PREFIX} ${tone.className}`;
}

/**
 * 采集到的中文价格标签 → 索引里的 `PriceCode`。
 *
 * 与 `scripts/generate-search-index.mjs` 的 `LABEL_TO_CODE` **必须一致**：
 * 那个脚本在构建期把 2081 条工具的价格写进 `data/search-index.json`，这里是
 * 服务端页面（首页 / 分类 / 详情页）从 `tool-extras.json` 直接读的路径。
 * 两处口径一旦分叉，同一条工具在 `/tools` 与详情页会显示不同的价格胶囊 ——
 * 那是最难被发现、也最伤信任的一类不一致。
 *
 * 五档之外的标签（含 `未知` 与空）一律 `unrated`，不推测。
 */
export function priceCodeFromLabel(label: unknown): PriceCode {
  if (typeof label !== 'string') return 'unrated';
  return LABEL_TO_CODE[label] ?? 'unrated';
}

const LABEL_TO_CODE: Record<string, PriceCode> = {
  免费: 'fully-free',
  免费开源: 'open-source',
  免费增值: 'freemium',
  付费: 'paid',
};

/**
 * 价格胶囊的**短标签**（卡片上用）。
 *
 * 详情页 hero 上的那枚胶囊用的是原站四档原文（`pricingBadgeClass(label)`，
 * 免费 / 免费增值 / 付费 / 免费开源）；卡片比 hero 窄得多，四个字以内才能
 * 与「更新于 …」并排放进一行，所以这里换成两字短名。`unrated` 返回 `''`，
 * 调用方据此整枚不渲染 —— 缺采集数据的 55 条工具不该挂一枚灰胶囊假装有数据。
 */
export function priceShortLabel(code: PriceCode | undefined): string {
  switch (code) {
    case 'fully-free':
      return '免费';
    case 'open-source':
      return '开源';
    case 'freemium':
      return '免费额度';
    case 'paid':
      return '付费';
    default:
      return '';
  }
}

