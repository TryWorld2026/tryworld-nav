import Link from 'next/link';
import { tagByName } from '@/lib/tags';
import { rgb, rgbAlpha } from '@/lib/utils';
import type { Tool } from '@/lib/types';

/**
 * 全站工具网格的唯一轨道定义。
 *
 * 2026-10-18：原先四处各写一套 `sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4
 * 2xl:grid-cols-5`。固定列数的毛病是卡片宽度完全跟着视口走：768 下两列只剩
 * 345，1024 扣掉 192 侧栏后三列掉到 245、1280 四列 250 —— 同一个组件在
 * 736–800 区间里来回缩，标题频繁折行。改成「最小轨道 280px、能塞几列塞几列」
 * 之后卡片宽度被钳在 280–380 之间，列数由容器自己算：
 *
 *   768 → 2 列 376 · 1024 → 2 列 376 · 1280 → 3 列 336
 *   1440 → 4 列 284 · 1536 → 4 列 308 · ≥1800 → 5 列 296–326
 *
 * 轨道写成 `min(280px,100%)`：容器窄于 280 时（320 宽的手机）不会被
 * 280px 的硬最小宽度顶出横向滚动条。
 *
 * 注意 `auto-fill` 不是 `auto-fit`：后者会在条目不足时把空轨道压掉、让最后
 * 一行两张卡拉成两倍宽，看起来像排版出错。
 */
export const TOOL_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4';

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
  hideCategorySlug,
}: {
  tool: Tool;
  emphasis?: boolean;
  /**
   * A replacement for the chip row this card derives itself. The 精选AI利器集合
   * member grids pass their own — the same tag chips, but built from the
   * collection payload's own member list rather than the catalog.
   */
  chips?: React.ReactNode;
  /**
   * 详情页用：卡片已经在那个分类的页面里，底部再挂一遍同名分类 chip
   * 只是把「你在哪」重复了 2081 次。传当前分类的 slug，从 chip 行里滤掉它；
   * 滤完什么都不剩时，整行（含 12px 的 `pt-3`）都不渲染，卡片收得更紧。
   */
  hideCategorySlug?: string;
}) {
  const cats = (tool.categories ?? []).filter((c) => c.slug !== hideCategorySlug);

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
      <div className="flex flex-wrap gap-1.5">
        {toolTags.map((g) => (
          <span
            key={g.slug}
            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-foreground/10 px-1.5 py-0.5 text-[12px] text-foreground/70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.iconUrl}
              alt=""
              width={14}
              height={14}
              loading="lazy"
              decoding="async"
              className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
            />
            <span className="truncate">{g.name}</span>
          </span>
        ))}
      </div>
    ) : null;

  const bottom =
    chips ??
    tagChips ??
    (cats.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <span
            key={c.id}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-foreground/10 px-1.5 py-0.5 text-[12px] text-foreground/70"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: rgb(c.color) }}
            />
            <span className="truncate">{c.name}</span>
          </span>
        ))}
      </div>
    ) : null);

  /*
   * 2026-10-17 重做。原来的卡片是照抄原站的「魔法边框」：8px 内边距、圆角 8px、
   * 标题与描述各强制一行（`line-clamp-1`）。在 4~7 列的网格里，卡片宽度掉到
   * 200px 以下，标题只剩「Lovart 全球首个专业…」，整页像一张表格而不是一个
   * 内容产品 —— 用户的原话是「没有设计感、排版粗糙」。
   *
   * 现在改成：
   *   - 标题最多两行、描述最多两行（`line-clamp-2`），信息能自己解释自己；
   *   - 内边距 16px（原 8px），图标 44px，标题与描述用 2/8 的间距成组；
   *   - 边框改成实色 hairline、hover 抬升 1px + 边框加深 + 阴影，卡片是「浮起
   *     来的一张纸」而不是表格里的一格；
   *   - 分类/标签 chips 放在底部并用 `mt-auto` 压到卡片底缘，同一行里高度一致。
   *
   * 保留 `emphasis`：最新添加区块的 hover 阴影更重，这是原站就有的区分。
   */
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className={`group flex h-full flex-col rounded-xl border border-foreground/10 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-foreground/5 active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        emphasis ? 'hover:shadow-lg' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03]">
          {tool.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tool.icon}
              alt={tool.name}
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="h-11 w-11 object-contain"
            />
          ) : (
            <span className="text-base font-bold text-foreground/70">
              {tool.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-gongke-accent">
            {tool.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-gongke-muted">
            {tool.description}
          </p>
        </div>
      </div>

      {/* 底部一行：`mt-auto` 把 chip 行压到卡片下缘，同一行里不同长度的描述
          不会让卡片高度参差。`chips` 由集合页传入，同样套这层间距。
          一行都没有时整块不渲染 —— 空着的 `pt-3` 会让卡片底部凭空多出
          12px，同一网格里这些卡就比有 chip 的矮一截。 */}
      {bottom && <div className="mt-auto pt-3">{bottom}</div>}
    </Link>
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
