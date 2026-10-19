import Link from 'next/link';
import { tagByName } from '@/lib/tags';
import { asset } from '@/lib/assets';
import { rgb, rgbAlpha } from '@/lib/utils';
import type { Tool } from '@/lib/types';
import thumbs from '@/thumbs.json';

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

/**
 * 缩略图 srcSet。清单 `src/thumbs.json` 由 `scripts/gen-thumbs.mjs` 全量跑完后
 * 写入；计数为 0 时（媒体目录不存在、或只跑了 `--limit` 验证）整组属性都不输出，
 * 页面退回原图 —— 这是唯一安全的形式。
 *
 * 为什么必须由清单开关，而不是「srcSet 挂了浏览器会退回 src」：实测不成立。
 * 用 Chromium 1248 逐条验证过 —— `<img src="ok.png" srcSet="missing.webp 88w">`、
 * `<img srcSet="missing.webp 800w, ok.png 1920w">`、`<picture><source srcset="missing.webp">`
 * 三种写法，`currentSrc` 全部停在那个 404 的候选上、`naturalWidth` 为 0，
 * **浏览器不会回退到 `src`**（请求记录里两个文件都发了，但失败后不重选）。
 * 所以「只指向 thumbs、留 src 兜底」只会在没跑过脚本的机器上换成一屏破图，
 * 比不做更糟。
 *
 * 页面渲染在构建期跑（server component 与 client 组件的首屏 HTML 都是），
 * 构建期读 `fs` 判断单个文件是否存在也可以，但 `tool-card.tsx` 同时被
 * `tools-explorer.tsx`（'use client'）引用，模块级 `fs` 会让客户端打包直接
 * 失败。所以把判断前移到脚本：脚本生成文件、同时记下计数，页面只读一个
 * 两键 JSON（`src/thumbs.json`，由 `contentBuildId()` 一起哈希，因为清单变了
 * 页面字节就变）。
 */
const HAS_ICON_THUMBS = thumbs.icons > 0;
const HAS_SHOT_THUMBS = thumbs.shots > 0;

/**
 * `/assets/icons/lovart-ai.png` → `/assets/thumbs/icons/lovart-ai.webp`。
 *
 * 传进来的 `src` 已经过 `asset()`（可能带 `NEXT_PUBLIC_ASSET_BASE` 主机前缀），
 * 所以不能直接换字符串前缀；取 `/assets/{kind}/` 之后的部分重新走一遍
 * `asset()`，两种前缀形式都对。文件名与 slug 一致是媒体目录的既有约定
 * （实测 2082 个图标 / 2081 张截图里，只有 1 个图标 `libtv` 不对应任何 slug）。
 */
function thumbPath(src: string, kind: 'icons' | 'shots', suffix: string): string | undefined {
  const marker = `/assets/${kind}/`;
  const at = src.indexOf(marker);
  if (at < 0) return undefined;
  const file = src.slice(at + marker.length);
  if (!file || file.includes('/')) return undefined;
  const slug = file.replace(/\.[^./]+$/, '');
  if (!slug || slug === file) return undefined;
  return asset(`/assets/thumbs/${kind}/${slug}${suffix}`);
}

/**
 * 图标候选：88w 的 webp + 原图。
 *
 * `sizes="44px"` 对应卡片里 44×44 的盒子，DPR 2 要 88px —— 正好落在 webp 上，
 * 所以 Retina 也吃缩略图。原图只作为 3x 以上的候选，因此**矢量图标不进
 * srcSet**：SVG 没有固有像素宽度，`w` 描符对它没有意义，而矢量本身也没有
 * 「缩到 88px 省流量」这回事。
 */
/**
 * 图标候选：88w + 176w 两档缩略图。
 *
 * 为什么需要 88w **和** 176w 两档：卡片里的盒子是 44 CSS px，DPR1/2 要
 * 44/88 device px，88w 够；**DPR3 的手机要 132px**，88w 不够，浏览器就会在
 * 88w 与「原图 176w」之间挑后者 —— 实测 DPR3 下 390 宽的首页，10 张可见图标
 * 全部退回原图（48 KB，缩略图只要 8 KB），而 icons/ 里最大一张原图 1.25 MB。
 * 176w 把 DPR4 也盖住（44×4），两档合计每个图标约 4 KB。
 *
 * 原图**刻意不进候选**：这两档已经把 DPR1–4 全覆盖，多留一条原图只会给浏览器
 * 多一个「挑到 1.25 MB」的机会，而没有任何画质收益（44px 的盒子里看不出
 * 176px 与 1024px 的差别）。`src` 属性仍然指向原图，那是清单关闭时的出口。
 *
 * **矢量图标不进来**：SVG 没有固有像素宽度，`w` 描符对它没有意义，而矢量
 * 本身也没有「缩小省流量」这回事。
 */
export function iconSrcSet(src: string): string | undefined {
  if (!HAS_ICON_THUMBS || !src) return undefined;
  if (/\.svg$/i.test(src)) return undefined;
  const thumb = thumbPath(src, 'icons', '.webp');
  const big = thumbPath(src, 'icons', '-176.webp');
  if (!thumb || !big) return undefined;
  return `${thumb} 88w, ${big} 176w`;
}

/**
 * 详情页截图候选：800w 的 webp + 原图。
 *
 * 原图那一条给的 `1600w` 是按截图宽度的**中位数档**估的（实测 p10 就已是
 * 1600，中位 1920）。w 描符只用于让浏览器在「需要 2x」时选它，候选本身不会被
 * 缩放，所以标偏小一点没有画质风险，只是让它在 DPR2 的窄屏上不被选中。
 * 逐张读真实宽度要多跑 2081 次 sharp metadata，构建期不值得。
 */
export function shotSrcSet(src: string): string | undefined {
  if (!HAS_SHOT_THUMBS || !src) return undefined;
  if (/\.svg$/i.test(src)) return undefined;
  const thumb = thumbPath(src, 'shots', '-800.webp');
  return thumb ? `${thumb} 800w, ${src} 1600w` : undefined;
}

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
      // `prefetch={false}` —— 这几行是首页/分类/工具页共用的卡片，全站首屏可见
      // 的工具有 39 个链接（首页）、/tools 是 60 个、分类页整屏 —— 而 Next 的
      // App Router 默认对**视口内**的每一条 <a> 预取整份 RSC payload。工具页的
      // RSC payload 实测平均 107 KB（`out/tools/*.txt`，2081 个文件），39 张卡
      // 全进视口等于凭空拉 4 MB，命中第一屏时还抢字体与图片的带宽。
      //
      // 代价是点进去时要等一次 RSC（本地 20–50 ms，线上多一个 RTT）。这是
      // 「首屏优先」的取舍：导航站的主要动作是**扫读**，一次读 20 张卡、只点 1
      // 张，为 19 张没被点开的预取付带宽不划算。
      prefetch={false}
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
              srcSet={iconSrcSet(tool.icon)}
              sizes="44px"
              // 装饰性：整张卡片是一个 <Link>，工具名已经由下面的 <h3> 承担。
              // 写成 alt={tool.name} 会让读屏把名字念两遍。
              alt=""
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
    // 这个行卡在工具页右栏出现 **两处 × 10 行**（类似工具 / 最新收录），
    // 所以一个工具详情页一打开就有 20 条视口内的链接在请求 RSC payload ——
    // 那不是「预取下一屏」，而是把右栏二十个页面的 2 MB 预取塞进出站队列，
    // 与截图、字体抢同一条连接。见 ToolMiniCard 上的同一条注释。
    <Link href={`/tools/${tool.slug}`} prefetch={false}>
      <div className="flex items-center group border-b border-muted border-dashed py-1">
        <div className="w-8 h-8 rounded-md mr-1 flex items-center justify-center overflow-hidden">
          {tool.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tool.icon}
              srcSet={iconSrcSet(tool.icon)}
              sizes="24px"
              // 同上：名字就在紧挨着的 <span> 里，图标是装饰性的。
              alt=""
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
