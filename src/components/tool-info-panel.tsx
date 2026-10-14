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
 *                                 Its dot is the origin's own hardcoded
 *                                 #00AF79, which is not the green used by the
 *                                 pricing badge — a coincidence of palette, not
 *                                 a shared token.
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

/** The 支持平台 dot colour — the origin's own literal, not a shared token. */
const PLATFORM_DOT = '#00AF79';

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
    <div className="rounded-lg border border-muted bg-white p-6 backdrop-blur-sm">
      <h2 className="mb-4 font-display text-xl font-medium text-foreground">
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
                className="space-x-1 hover:underline hover:text-accent"
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
                {row.logo && <span dangerouslySetInnerHTML={{ __html: row.logo }} />}
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
              <span dangerouslySetInnerHTML={{ __html: p.icon }} />
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
