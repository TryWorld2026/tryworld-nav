/**
 * The right rail's 相关信息 panel — 开发者 / 支持平台, verbatim.
 *
 * Two independent sub-blocks share one card:
 *
 *   .flex.items-center.relative   one row per `info` entry. A dual-circle dot
 *                                 (14×15, the entry's own colour) sits at
 *                                 absolute top-1.5 and the text is pushed right
 *                                 by ml-5, so long names wrap without touching
 *                                 the dot. The label is `开发者 - ` — a data
 *                                 field, not a constant, because a future
 *                                 harvest could carry a second row kind.
 *   .flex.flex-wrap.gap-2.mt-2    the 支持平台 label plus one chip per platform.
 *                                 Its dot was the origin's own hardcoded
 *                                 #00AF79 — a bright mint green that appears
 *                                 nowhere else on this site. 2026-10-27 swapped
 *                                 it for the brand green, so the platform chips
 *                                 and the pricing badge now belong to the same
 *                                 palette instead of merely both being "green".
 *
 * Each row's trailing favicon and each platform's icon are raw inline `<svg>`
 * strings from the harvest (the origin renders them from a CDN that no longer
 * serves them, so they are shipped as markup rather than as `<img src>`). They
 * are injected with `dangerouslySetInnerHTML`; the harvest pass refuses any
 * entry whose markup is not a bare `<svg>`, so nothing else can reach the page
 * through these strings — see the contract in `lib/tool-extras.ts`'s harvester.
 *
 * The card is skipped entirely when the entry carries neither block, rather
 * than rendering an empty bordered box with a heading.
 */

import { ArrowUpRight } from 'lucide-react';

import type { ToolInfoRow, ToolPlatform } from '@/lib/types';

/**
 * 支持平台色点。原站是 `#00AF79`（亮薄荷绿），全站没有任何第二处用它 ——
 * 它与价格徽章的品牌绿只是「都绿」，不是同一个色。2026-10-27 统一到品牌绿。
 */
const PLATFORM_DOT = '#24564E';

/**
 * 抓取来的 `<svg>` 里有没有**损坏的 path**。
 *
 * 2026-10-19 实测：`data/tool-extras.json` 有 449 个工具的 logo/icon 带着
 * `<path d="$58">` / `$59` / `$57` —— 收割时 SVG 的路径数据被截断成了一个
 * 变量引用（原站那个 CDN 早已不服务，抓到的就是残缺 markup）。这些字符串被
 * 原样注入后，浏览器每次渲染都报一条
 *
 *   Error: <path> attribute d: Expected moveto path command ('M' or 'm'), "$58".
 *
 * 并且那个图标位置是**空白**的 —— 全站 435 个详情页受影响，占 21%。
 *
 * 为什么在渲染层修而不是改数据：`tool-extras.json` 是抓取产物，手改下次
 * 抓取就丢。所以这里把明显残缺的整段 markup 丢掉，让调用方回退成纯文本
 * （见 `isRenderableSvg`），空白图标位置至少不再产生控制台报错。
 *
 * 判据刻意只认最确定的两种残缺：`d` 属性以 `$` 开头、或 `viewBox` 缺失。
 * 不做通用 SVG 校验 —— 这里的目标是"别把坏数据画出来"，不是当 HTML 消毒器。
 */
function isRenderableSvg(markup: string | undefined): markup is string {
  if (!markup) return false;
  if (!/^\s*<svg[\s>]/i.test(markup)) return false;
  // `d="$58"` —— 抓取截断的典型形态。
  if (/\sd\s*=\s*["']\s*\$/.test(markup)) return false;
  return true;
}

/**
 * The origin's dual-circle dot: a filled circle at r=3.81519 over a 20%-opacity
 * halo at r=7, inside a 14×15 box. The slight y-offset (7 vs 7.07495) and the
 * non-square box are the origin's own numbers and are kept so the two dots line
 * up with the label baseline exactly.
 */
function Dot({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="15"
      viewBox="0 0 14 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="6.81519" cy="7" r="3.81519" fill={color} />
      <circle cx="7" cy="7.07495" r="7" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

export function ToolInfoPanel({
  info,
  platforms,
}: {
  info: ToolInfoRow[];
  platforms: ToolPlatform[];
}) {
  if (info.length === 0 && platforms.length === 0) return null;

  return (
    <div className="rounded-xl border border-foreground/10 bg-card p-5">
      {/* 与右栏另外两张卡（类似工具 / 最新收录）同一档标题：
          14px/600。原来是 20px 的 font-display，三张同级卡片里
          只有它像个小节标题，读起来像是「相关信息」比别的卡重要。 */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        相关信息
      </h2>

      {info.map((row, i) => (
        <div className="relative flex items-center" key={`${row.label}-${i}`}>
          <div className="absolute top-1.5">
            <Dot color={row.dot} />
          </div>
          {row.href ? (
            <div className="ml-5">
              <span>{row.label} - </span>
              <a
                // 2026-10-23（task-2 第 6 条）：这条外链原先只有 hover 下划线，
                // 键盘聚焦时用的是浏览器默认蓝环。补成全站一致的 `ring-ring`
                // （品牌深绿，#24564E 对卡片底 7.94:1、对纸底 7.29:1，≥1.4.11
                // 的 3:1）。`rounded-sm` 只是让 2px 环贴合文字块，不改布局。
                className="rounded-sm space-x-1 hover:underline hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={row.href}
                target="_blank"
                rel="nofollow noopener noreferrer"
              >
                <span>{row.text}</span>
                {/* The origin's own harvested favicon SVG. It is not a rule-
                    suppressed escape hatch: the harvest pass rejects every slug
                    whose prose or extras carry a script/style/iframe/object/embed
                    element, an `on*` attribute or a `javascript:` URL (0 of 2081
                    did), and these two fields are the only remaining raw HTML. */}
                {isRenderableSvg(row.logo) && (
                  <span dangerouslySetInnerHTML={{ __html: row.logo }} />
                )}
                <ArrowUpRight className="inline h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          ) : (
            /* Some tools ship a developer with no link at all — the origin then
               renders one span carrying both the label and the name, with no
               arrow. Its class list differs from the linked row's wrapper. */
            <span className="inline-flex items-center ml-5">
              {row.label} - {row.text}
            </span>
          )}
        </div>
      ))}

      {platforms.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="mr-2 text-foreground">
            <div className="inline-flex items-center gap-1">
              <Dot color={PLATFORM_DOT} />
              支持平台 -
            </div>
          </div>
          {platforms.map((p) => (
            <div
              className="flex items-center gap-1 rounded-md bg-foreground/5 px-2 py-1 text-sm"
              key={p.name}
            >
              {isRenderableSvg(p.icon) && (
                <span dangerouslySetInnerHTML={{ __html: p.icon }} />
              )}
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
