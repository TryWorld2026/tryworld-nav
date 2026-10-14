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

/** The origin's class list for every tone, minus the tone-specific colours. */
export const PRICING_PREFIX =
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset';

const TONES = {
  free: {
    label: '免费',
    className:
      'bg-green-50 bg-opacity-50 text-green-700 ring-green-600/20',
  },
  freemium: {
    label: '免费增值',
    className:
      'bg-purple-50 bg-opacity-50 text-purple-700 ring-purple-600/20',
  },
  paid: {
    label: '付费',
    className:
      'bg-yellow-50 bg-opacity-50 text-yellow-700 ring-yellow-600/20',
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
