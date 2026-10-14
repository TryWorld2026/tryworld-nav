import Link from 'next/link';
import { tagByName } from '@/lib/tags';
import { rgb, rgbAlpha } from '@/lib/utils';
import type { Tool } from '@/lib/types';

/*
 * The origin's 更多AI工具 grid uses a different, denser card — shadcn's "magic
 * border" Card with the border drawn as two radial-gradient overlays that
 * brighten on hover, an inset fill, then the content. The structure below is
 * the origin's verbatim markup; only two things are dropped, both disclosed in
 * the project README:
 *
 *   1. The `animate-pulse bg-primary/10` square behind the icon. On the origin
 *      that is next/image's loading placeholder, which the origin removes from
 *      the DOM once the image has decoded. Our icons are local and decode
 *      synchronously, so keeping it would leave a permanently pulsing grey
 *      block showing through every transparent icon.
 *   2. `data-state="closed"` on the outer div — a Radix state attribute the
 *      origin's Card emits. Nothing in the origin's CSS selects on it.
 *
 * The 精选AI利器集合 member grids reuse this card verbatim, always with the
 * `hover:shadow-md` shadow, and swap the chip row for tag chips — see `chips`.
 */
export function ToolMiniCard({
  tool,
  emphasis = false,
  chips,
}: {
  tool: Tool;
  emphasis?: boolean;
  /**
   * A replacement for the chip row this card derives itself. The 精选AI利器集合
   * member grids pass their own — the same tag chips, but built from the
   * collection payload's own member list rather than the catalog.
   */
  chips?: React.ReactNode;
}) {
  const cats = tool.categories ?? [];

  // Which chip row a card carries is a property of the tool, not of the page:
  // counted across all 109 harvested origin pages, every card whose tool has
  // tags renders tag chips (a 16×16 tag icon plus the name) and every card
  // whose tool has none renders category chips (a coloured dot plus the name) —
  // 110 vs 1210 on the home page, 11 vs 150 on /categories/ai-agents, and zero
  // cards carrying both or neither. `Tool.tags` holds names, so `tagByName`
  // resolves each to its local icon.
  const toolTags = (tool.tags ?? []).map((n) => tagByName.get(n)).filter((t) => t !== undefined);
  const tagChips =
    toolTags.length > 0 ? (
      <div className="flex flex-nowrap overflow-x-clip text-nowrap gap-1 mt-1.5">
        {toolTags.map((g) => (
          <span
            key={g.slug}
            className="text-xs text-foreground/60 border border-foreground/5 rounded-md px-1 py-0.5 shadow-sm inline-flex min-w-fit items-center gap-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.iconUrl}
              alt={g.name}
              width={16}
              height={16}
              loading="lazy"
              decoding="async"
              className="rounded"
            />
            {g.name}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <div
      className={`rounded-xl border bg-card text-card-foreground border-none shadow-none ${
        emphasis ? 'hover:shadow-md' : 'hover:shadow-sm'
      }`}
    >
      <div className="group relative rounded-lg border-none transition-all duration-300 bg-white h-full">
        <div
          className="pointer-events-none absolute inset-0 rounded-lg bg-border duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(100px circle at -100px -100px, #9E7AFF, #FE8BBB, hsl(var(--magicborder)) 100%)',
          }}
        />
        <div className="absolute inset-px rounded-lg bg-white" />
        <div
          className="pointer-events-none absolute inset-px rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            opacity: 0.03,
            background: 'radial-gradient(100px circle at -100px -100px, #262626, transparent 100%)',
          }}
        />
        <div className="relative">
          <Link href={`/tools/${tool.slug}`} className="h-full flex flex-col p-2">
            <div className="p-1.5">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-10 h-10 relative flex-shrink-0">
                    {tool.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tool.icon}
                        alt={tool.name}
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        className="object-contain rounded-lg absolute inset-0"
                      />
                    ) : (
                      <span className="text-sm font-bold text-foreground/80">
                        {tool.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base text-foreground/80 line-clamp-1 text-ellipsis">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-gongke-muted line-clamp-1 text-ellipsis">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {chips ??
              tagChips ??
              (cats.length > 0 && (
                <div className="flex flex-nowrap overflow-x-clip text-nowrap gap-1 mt-1.5">
                  {cats.map((c) => (
                    <span
                      key={c.id}
                      className="text-xs text-foreground/60 border border-foreground/5 rounded-md px-1 py-0.5 shadow-sm inline-flex items-center gap-1"
                    >
                      <span
                        className="rounded p-0.5"
                        style={{ backgroundColor: rgbAlpha(c.color, 0.2), color: rgb(c.color) }}
                      />
                      {c.name}
                    </span>
                  ))}
                </div>
              ))}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The dense row used by the 类似工具 and 最新收录 rails. One line, 24×24 icon,
 * dashed rule underneath. `min-w-0` on the label keeps `line-clamp-1` honest
 * inside a flex row.
 */
export function ToolRowCard({ tool }: { tool: Tool }) {
  return (
    <Link href={`/tools/${tool.slug}`}>
      <div className="flex items-center group border-b border-muted border-dashed py-1">
        <div className="w-8 h-8 rounded-md mr-1 flex items-center justify-center overflow-hidden">
          {tool.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tool.icon}
              alt={tool.name}
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              className="object-contain rounded-md"
            />
          ) : (
            <span className="text-xs font-semibold text-neutral-600">
              {tool.name.slice(0, 1)}
            </span>
          )}
        </div>
        <span className="group-hover:text-gongke-accent transition-colors text-sm text-neutral-600 line-clamp-1">
          {tool.name}
        </span>
      </div>
    </Link>
  );
}
