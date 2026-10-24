import Link from 'next/link';
import { tagByName } from '@/lib/tags';
import { asset } from '@/lib/assets';
import { rgb, rgbAlpha } from '@/lib/utils';
import { freshLabel, type CardTool } from '@/lib/card';
import { DATA_EPOCH } from '@/lib/catalog-index';
import { priceShortLabel } from '@/lib/pricing';
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
  /**
   * `CardTool` 是 `Tool` 的**结构子集**，所以服务端页面照旧直接传完整 `Tool`；
   * `/tools` 与命令面板传 `cardFromRecord(record)`。见 `lib/card.ts`。
   */
  tool: CardTool;
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

  /*
   * 卡片上的价格胶囊 —— 只挂**会改变决定**的那三档。
   *
   * 2081 条的分布是：免费增值 1737（83%）、免费 183、免费开源 55、付费 51、
   * 无采集 53。把四档都挂上去，等于在每一屏 60 张卡上重复 50 次「免费额度」，
   * 那不是信息，是墙纸；而真正需要被看见的两件事 ——「这个真的不要钱」和
   * 「这个要付钱」—— 会被那 50 次重复淹掉。
   *
   * 所以规则是：
   *   免费 / 开源 → 挂（读者会因此点进去）
   *   付费       → 挂（读者会因此先看价格页）
   *   免费额度   → 不挂（多数派，不构成区分）
   *   未采集     → 不挂（不假装有数据）
   *
   * 想看「只看免费额度」的人走 `/tools?price=freemium` 筛选，那里有完整口径。
   */
  const price =
    tool.price === 'fully-free' || tool.price === 'open-source' || tool.price === 'paid'
      ? priceShortLabel(tool.price)
      : '';

  /*
   * 平台：卡片上只露前两个，多的折成 `+N`。
   *
   * 这是「我能不能用」的前置问题 —— 一个只有 iOS 的工具对一个 Windows 用户
   * 是零，而现在的卡片完全不区分，读者必须点进详情页才知道。但平台名长度
   * 差异很大（`Web` 3 字符、`微信小程序` 5 个汉字），所以只给两个位置，
   * 其余折成计数，剩下的交给 `/tools?platform=…` 与详情页。
   *
   * **没有平台数据就不渲染这一行**（2081 条里有相当一部分没采到），
   * 不要写「未知」。
   */
  const platforms = tool.platforms ?? [];
  const shownPlatforms = platforms.slice(0, 2);
  const morePlatforms = platforms.length - shownPlatforms.length;

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

  const fresh = freshLabel(tool.updated, DATA_EPOCH);

  /*
   * 底部那一行 —— 卡片上唯一「可比较」的地方。
   *
   * 审计的核心结论是「能找到工具，但选不出工具」：2081 张卡的底部以前只有
   * 标签/分类 chip，那描述的是「它是什么」，不是「它和我有什么关系」。
   * 价格与平台才是决定要不要点进去的两条事实，而它们以前完全不在卡片上。
   *
   * 排版顺序按「读者最想先知道的」排：价格 → 平台 → 新鲜度。
   * 三者都没有时这一行整块不渲染（不是渲染一个空 div）。
   *
   * 2026-10-23 复查（task-2 第 5 条）：这一行是 11px + `text-gongke-muted`，
   * 实测对卡片底 **5.31:1**（`work/_contrast.mjs`），已在 AA 的 4.5:1 之上，
   * 所以字号与颜色**刻意不动** —— 卡片是 15/13/11 三档，meta 提到 12px 或
   * 加粗就与描述同级，「描述 → 可比较的事实」的层级会塌掉。
   */
  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-none text-gongke-muted">
      {price && (
        <span
          className={
            price === '付费'
              ? 'inline-flex items-center rounded border border-[#B54826]/25 bg-[#F2693C]/[0.07] px-1.5 py-0.5 font-medium text-[#B54826]'
              : 'inline-flex items-center rounded border border-gongke-accent/25 bg-gongke-accent/[0.07] px-1.5 py-0.5 font-medium text-gongke-accent'
          }
        >
          {price}
        </span>
      )}
      {shownPlatforms.length > 0 && (
        <span className="truncate">
          {shownPlatforms.join(' · ')}
          {morePlatforms > 0 && ` +${morePlatforms}`}
        </span>
      )}
      {fresh && <span className="truncate">{fresh}</span>}
    </div>
  );
  const hasMeta = Boolean(price) || shownPlatforms.length > 0 || Boolean(fresh);

  /*
   * 底部分两行：**可比信息行（meta）永远在**，chip 行可被 `chips` 覆盖。
   *
   * 2026-10-22 修：原来是 `chips ?? (tagChips || cats.length || hasMeta ? …)` ——
   * `??` 一旦命中 `chips` 就整体短路，于是集合页传了 `chips`（它要渲染集合
   * 自己的标签 chip）的卡片**连价格/平台/新鲜度一起丢了**。实测
   * `/collections/ai-digital-human-tools` 的 6 个成员都有 platforms 数据，
   * 页面上一处都不显示，而同一批工具在分类页显示「Web · iOS」。
   *
   * 两行职责不同：meta 说的是「这个工具要不要花钱、能不能在我的设备上跑、
   * 还新不新」；chips 说的是「它属于什么」。前者不该被后者替换掉。
   */
  const chipRow =
    chips ??
    tagChips ??
    (cats.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <span
            key={c.slug}
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

  const bottom =
    hasMeta || chipRow ? (
      <>
        {hasMeta && <div className={chipRow ? 'mb-1.5' : ''}>{meta}</div>}
        {chipRow}
      </>
    ) : null;


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
 *
 * 2026-10-22：右侧补一个价格胶囊。这两条 rail 是详情页里**唯一**把人带去
 * 别的工具的入口，而原先它们只有名字 —— 一个在「免费 + Windows」筛选下
 * 挑中某工具的人，滚到「类似工具」看到 10 个名字，其中混着付费的、只有
 * iOS 的，看不出差别，等于把刚建立的筛选条件丢了。补上价格档位之后，
 * 至少「这一列里哪些还要付钱」是扫一眼能看出来的。
 *
 * 为什么只补价格、不补平台与新鲜度：这条 rail 在 md–lg 下栏宽只有
 * 224–298px（1/3 容器减列距），名字本来就常被截断。价格是最短且最影响
 * 决定的一条事实（3 个汉字），平台名（"Windows"、"macOS"）一加就把名字挤没。
 * 卡片网格里的 `ToolMiniCard` 三者都有，那里宽度足够。
 */
export function ToolRowCard({ tool }: { tool: CardTool }) {
  const price = priceShortLabel(tool.price);

  /*
   * 2026-10-23 工艺修补（task-2）。三处，全是样式类，DOM 与 props 未动：
   *
   *   1. **名字改成两行**（原 `line-clamp-1`）。这条 rail 在 1440 宽下每格只有
   *      164px：右栏内宽 344（rail 容器 1216 / 3 列 − 列距）− 卡片 p-5 40 −
   *      两列 gap-x-4 16，再 ÷2。扣掉 32px 图标、6px 间距与价格，14px 的名字
   *      只剩 70–80px ≈ 8–10 个字符 —— 实测渲染成 `Microso…`、`Upscale.n`。
   *      改 `line-clamp-2` + `leading-snug`（14px × 1.375 = 19.25px）后
   *      `Chatbase`、`Microsoft Copilot` 都能完整读到；短名仍占一行，卡片
   *      高度只在长名处增加。
   *
   *   2. **价格降级成 12px 纯文本**（原 10px 胶囊：border + 7% 底色 + px-1）。
   *      这两条 rail 是 10 + 10 行，而 2081 条里 83% 是 freemium，于是
   *      「免费额度」在右栏重复 8 次以上 —— 一排实心底块比名字还抢眼。
   *      去掉边框与底色后信息不丢，字号反而从 10px 提到 12px：
   *      付费 #B54826 on 卡片 4.73:1 → **5.08:1**；免费/开源/免费额度
   *      text-gongke-muted **5.31:1**（旧绿徽章 7.11:1）。数字见
   *      `work/_contrast.mjs`。
   *
   *   3. **补焦点环**：这个 `<Link>` 原先没有任何 `focus-visible` 样式，
   *      键盘走进右栏 20 行只剩浏览器默认蓝。现在与全站一致用 `ring-ring`
   *      （深绿，对卡片底 7.94:1、对纸底 7.29:1，远高于 1.4.11 的 3:1）。
   */
  return (
    // 这个行卡在工具页右栏出现 **两处 × 10 行**（类似工具 / 最新收录），
    // 所以一个工具详情页一打开就有 20 条视口内的链接在请求 RSC payload ——
    // 那不是「预取下一屏」，而是把右栏二十个页面的 2 MB 预取塞进出站队列，
    // 与截图、字体抢同一条连接。见 ToolMiniCard 上的同一条注释。
    <Link
      href={`/tools/${tool.slug}`}
      prefetch={false}
      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
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
        <span className="min-w-0 flex-1 line-clamp-2 text-sm leading-snug text-neutral-600 group-hover:text-gongke-accent transition-colors">
          {tool.name}
        </span>
        {price && (
          <span
            className={`ml-2 shrink-0 text-[12px] ${
              price === '付费' ? 'font-medium text-[#B54826]' : 'text-gongke-muted'
            }`}
          >
            {price}
          </span>
        )}
      </div>
    </Link>
  );
}
