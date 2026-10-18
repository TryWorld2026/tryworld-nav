/**
 * 站内四个内容容器 token 的类名映射（四者的定义都在 `globals.css` 末尾）。
 *
 * 为什么单独抽一个模块：资讯频道的五个分区正文宽度并不一致，而**频道栏与
 * 报头必须和正文用同一把尺子**，否则 2560 下会量出 100–330px 的错位
 * （见 `news-tabs.tsx` 里 `NewsTabsWidth` 的注释）。这套映射原先只写在
 * `news-tabs.tsx` 里；报头要跟着一起切换宽度时再抄一份，就会出现「改了
 * 频道栏忘了报头」的错位，所以放在这里共享。
 *
 * 这些类**都不在任何 `@layer` 里**，优先级高于 Tailwind 的 `max-w-*`
 * utilities —— 同一个元素上再叠一个 `max-w-[…]` 是无效的，只能换类名。
 */
export const SECTION_WIDTH_CLASS = {
  /** 68rem / 1088 —— 整段阅读：资讯流卡片、热点榜、周报索引。 */
  reading: 'reading-container',
  /** 1280 → 86rem / 1376 —— 三栏版块：日报正文（归档 + 正文 + 日历）。 */
  rail: 'rail-container',
  /** 860 —— 窄栏期报正文：周报 / 月报的单期阅读页。 */
  period: 'period-container',
  /** 1280 → 1760（≥2100）—— 站内通用内容宽度：目录页、归档页、资讯索引页。 */
  content: 'content-container',
} as const;

export type SectionWidth = keyof typeof SECTION_WIDTH_CLASS;
