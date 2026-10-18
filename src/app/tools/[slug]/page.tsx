import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Timer } from 'lucide-react';
import { notFound } from 'next/navigation';

import { AdSlot } from '@/components/ad-slot';
import { CategoryIcon } from '@/components/category-icon';
import { ToolActions } from '@/components/tool-actions';
import { ToolInfoPanel } from '@/components/tool-info-panel';
import { TOOL_GRID, ToolMiniCard, ToolRowCard } from '@/components/tool-card';
import { ToolProse } from '@/components/tool-details';
import {
  SITE,
  extrasBySlug,
  latestAdditions,
  moreTools,
  relatedTools,
  toolBySlug,
  tools,
} from '@/lib/data';
import { pricingBadgeClass } from '@/lib/pricing';
import { buttonPrimary } from '@/lib/styles';
import { canonical } from '@/lib/canonical';

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

/**
 * The origin's `<title>` is `{name} - {tagline} | {站点名}`, which is NOT what
 * `layout.tsx`'s `title.template` (`%s - {站点名}`) would produce from a bare
 * string — the template would append the site name a second time. Returning the
 * absolute string defeats the template, which is the only way to get the
 * origin's exact form.
 *
 * The meta description is the origin's own long SEO paragraph, harvested per
 * page. It is a separate hand-written blurb — not the short tagline from
 * `tools.json` and not the first paragraph of `prose` — so it cannot be
 * synthesised; see `description` on `ToolExtras`. Two slugs (deta-surf,
 * hyperspace) ship no blurb on the origin either and fall back to the tagline.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug.get(slug);
  if (!tool) return { title: '工具未找到' };

  const extras = extrasBySlug(slug);
  const description = extras?.description || tool.description;

  return {
    ...canonical(`/tools/${slug}`),
    // Absolute, not a bare string — see the note above about `title.template`.
    title: { absolute: `${tool.name} - ${tool.description} | ${SITE.name}` },
    description,
    keywords: [
      tool.name,
      `${tool.name}官网`,
      `${tool.name}官网入口`,
      `${tool.name}下载`,
      `${tool.name}网页版`,
    ],
    openGraph: {
      type: 'website',
      title: `${tool.name} - ${tool.description} | ${SITE.name}`,
      description,
      images: tool.image ? [{ url: tool.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tool.name} - ${tool.description} | ${SITE.name}`,
      description,
      images: tool.image ? [tool.image] : undefined,
    },
  };
}

/**
 * `更新于2025年10月11日` — the origin formats the timestamp with the browser's
 * local timezone, which would make a prerendered page differ per viewer. The
 * UTC getters keep the build deterministic; the alternative (rendering the
 * viewer's own date) is not reproducible and not what a static replica wants.
 */
function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = toolBySlug.get(slug);
  if (!tool) notFound();

  const extras = extrasBySlug(slug);
  const primary = tool.categories[0];
  const pricingClass = pricingBadgeClass(extras?.pricing);
  const updatedLabel = extras?.updated ? formatUpdated(extras.updated) : '';

  return (
    <>
      {/* ── Hero band ────────────────────────────────────────────────────
          Full-bleed, closed by a hairline border. The inner column used to be
          `brand-container` (1536px), which made the tool page 256px wider than
          every other route at 1920 — the h1 sat at x=380 while /tools' sat at
          448. 现在与下方正文同一个 `.rail-container`（外框已与全站同为
          1760，见 `globals.css` 里 2026-10-18 的那段说明）。 */}
      <div className="border-b border-foreground/10 bg-background">
        {/* Hero 与正文共用同一个容器：之前 hero 用 `.content-container`、
            正文用更窄的一套，2560 下标题与正文左缘差 160px。 */}
        <div className="rail-container py-8 md:py-10">
          {/* 标题 + 动作按钮：`justify-between` 在宽容器里会把按钮推到最右，
              中间留 800px 空白。曾经用 `max-w-[64rem]` 收住整行 —— 代价是
              按钮组右缘与右栏卡片对不齐。
              现在 `xl` 起直接复用下面正文的三列栅格（同 gap-8、同列宽），
              标题占两列、按钮贴第三列右缘：hero 与正文的左右缘都落在容器
              的同一对边界上。 */}
          <div className="mb-6 grid grid-cols-1 gap-5 md:flex md:items-center md:justify-between xl:grid xl:grid-cols-3 xl:items-center xl:gap-8">
            <div className="flex min-w-0 items-center xl:col-span-2">
              <div className="mr-5 h-14 w-14 flex-shrink-0">
                {tool.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tool.icon}
                    alt={tool.name}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-full w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-foreground/5 text-xl font-bold">
                    {tool.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-3xl leading-tight text-foreground 2xl:text-4xl">
                  {tool.name}
                </h1>
                <p className="mt-1 text-gongke-muted">{tool.description}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-start space-y-3 md:mt-0 md:flex-row md:items-center md:space-x-3 md:space-y-0 xl:col-start-3 xl:justify-self-end">
              <ToolActions
                slug={tool.slug}
                name={tool.name}
                description={tool.description}
              />
              {/* 访问官网 — the origin links straight to the product's own
                  site, harvested per entry. The earlier Bing search button
                  was a placeholder and is gone. */}
              {/* 手机上这一组是竖排：`分享` / `添加收藏` 两个描边按钮占一行，
                  主按钮落单到第二行、还只占 96px 宽，读起来像附属品。
                  所以 md 以下让主按钮撑满整行 —— 全站唯一的主操作用满宽
                  绿条，和 APP 里「底部/区块主按钮」的份量一致。 */}
              <a
                href={extras?.external ?? `/tools/${tool.slug}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="w-full md:w-auto"
              >
                <button type="button" className={`${buttonPrimary} w-full md:w-auto`}>
                  <span>访问官网</span>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </button>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {pricingClass && (
              <div>
                <span className={pricingClass}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1 h-4 w-4"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="6" />
                  </svg>
                  {extras?.pricing}
                </span>
              </div>
            )}

            {/* One pill only — the origin renders the primary category, not
                every category the entry carries. */}
            {primary && (
              <Link href={`/categories/${primary.slug}`}>
                <div className="flex items-center gap-1 rounded-full bg-foreground/5 px-3 py-1 text-sm text-gray-500 transition-colors hover:bg-foreground/10">
                  <CategoryIcon name={primary.icon} className="h-4 w-4" />
                  {primary.name}
                </div>
              </Link>
            )}

            {updatedLabel && (
              <div className="flex items-center gap-1 rounded-full bg-foreground/5 px-3 py-1 text-sm text-gray-500 transition-colors hover:bg-foreground/10">
                <Timer width={16} height={16} aria-hidden="true" />
                <time dateTime={extras?.updated}>{`更新于${updatedLabel}`}</time>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body band ───────────────────────────────────────────────────
          Two columns on md+, the rail taking one of three. */}
      {/* 外框与全站同一宽度（`.rail-container` 2026-10-18 起与
          `.content-container` 同一条阶梯），所以工具页的顶栏、正文、页脚
          在 1920 / 2560 上左缘是同一根线 —— 不再出现「进详情页整个版心
          向内缩 192px」。
          正文列（1760 下 1120）宽于 prose 的 48rem 是**有意的**：文字块
          保持 48 个汉字/行的阅读口径，右边距留给右栏；卡片带（截图、
          「更多AI工具」）铺满整列，形成窄正文/宽卡片的层次。把正文拉成
          1120 宽才是真正的毛病 —— 一行 70 个汉字，眼球横移找不到下一行。 */}
      <div className="rail-container bg-background py-10">
        {/* 三个直接的网格子项，而不是「左栏套着两块」：
            1) 截图 + 正文           md 跨 2 列、第 1 行
            2) 右栏（信息面板等）    md 第 3 列、跨 1–2 行、吸顶
            3) 更多AI工具            md 跨 2 列、第 2 行

            2026-10-18 之前 3 是嵌在 1 里的，于是手机上「相关信息 / 支持平台」
            被压到 18 张工具卡之后（实测第 9.6 屏才出现）—— 一块高价值信息
            排在了最不值钱的位置。拆开后移动端顺序变成 截图→正文→右栏→更多
            工具，桌面视觉完全不变（右栏跨两行，所以第 2 行仍从正文下方开始）。

            `md:gap-y-2`：行距收成 0.5rem，配合「更多AI工具」h2 自带的
            1rem margin-top，正文末段到标题的间距才与独立成栏前一致；
            列距仍由 `gap-8` 给 2rem。 */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-y-2">
          <div className="md:col-span-2 md:row-start-1">
            {tool.image && (
              <div className="mb-8 overflow-hidden rounded-lg border border-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tool.image}
                  alt={`${tool.name} 截图`}
                  width={800}
                  height={450}
                  loading="lazy"
                  className="h-auto w-full"
                />
              </div>
            )}

            {/* The origin published no 产品介绍 body at all for three slugs
                (d-id, rabbitos-intern, youchuan); their extras entry exists
                only to carry the 相关信息 rows, so the block is skipped
                rather than rendered as an empty prose box. */}
            {extras && extras.prose ? <ToolProse prose={extras.prose} /> : null}

            {/* Inert placeholder — the origin's real AdSense unit
                (ca-pub-3128385017768065 / 2176275884) is deliberately not
                shipped; see AdSlot. */}
            <AdSlot slot="2176275884" className="mb-4 mt-8 w-full" />

          </div>

          {/* 右栏在桌面吸顶。不吸顶时它只有约 1060px，而正文列有两屏多 ——
              读者越过第一屏后右半屏是永久空白的，这是 2081 个工具页共用的
              模板，也是「宽屏布局塌陷」最集中的一处。

              几个不能省的细节：
              - `md:` 而不是 `lg:`：与上方 `md:grid-cols-3` 同断点，否则
                768–1023 又是空的；
              - `md:self-start`：网格项默认被 stretch 成同高，sticky 没有
                可移动的行程；
              - `top` 用 `--site-header-h`（`header.tsx` 实测写入，顶栏滚过
                160px 会收起并置 0），右栏随之上移，不留固定 80px 的空带；
              - `max-h` + `overflow-y-auto`：右栏实测 1060–1120px，比 900
                高的窗口还高，只加 sticky 会把「最新收录」下半段永远顶出
                屏幕。写法与 `news-daily-archive.tsx` 一致。 */}
          <div className="min-w-0 space-y-5 scrollbar-thin md:sticky md:top-[calc(var(--site-header-h,3.5rem)+1rem)] md:col-start-3 md:row-span-2 md:row-start-1 md:max-h-[calc(100vh-var(--site-header-h,3.5rem)-2rem)] md:self-start md:overflow-y-auto">
            <div className="rounded-lg bg-transparent">
              <div className="adsense-container">
                <AdSlot slot="3461578336" />
              </div>
            </div>

            <ToolInfoPanel
              info={extras?.info ?? []}
              platforms={extras?.platforms ?? []}
            />

            <div className="rounded-xl border border-foreground/10 bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">类似工具</h2>
              {/* 行卡列数跟着**栏宽**走，不跟着视口走。栏在 md–lg 只有 224–298px
                  （1/3 的容器减列距），这里若按 `sm:` 排两列，每列不足 100px，
                  工具名会截成「Lobe…」「Characte」。所以 md 起先收回单列，
                  到 xl（栏 384px，每列 184）再放两列；sm–md 之间栏还是整宽
                  堆叠，两列反而正好。 */}
              <div className="grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                {relatedTools(tool.slug, 10).map((t) => (
                  <ToolRowCard tool={t} key={t.slug} />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-foreground/10 bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">最新收录</h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                {latestAdditions.map((t) => (
                  <ToolRowCard tool={t} key={t.slug} />
                ))}
              </div>
            </div>
          </div>

          {/* 移动端顺序靠 DOM 决定：上面右栏先出现，这一块后出现。桌面上它
              靠 `md:row-start-2` 回到正文下方、右栏左侧 —— 视觉与拆开前一致。
              保留 `.tool-details`（h2 的字体与 margin-top 来自这条作用域）。 */}
          <div className="tool-details md:col-span-2 md:row-start-2">
            <h2 className="mb-5 font-display text-2xl">更多AI工具</h2>
            {/* 与首页 / /tools / 分类详情共用 `TOOL_GRID`：卡片宽度由同一条
                280px 最小轨道决定，从分类页点进工具页再往下滚，「更多工具」
                那一片的密度不会突然变一档。原先写死 `xl:grid-cols-3`，
                1760 下每张卡 370px，比全站任何一处都宽一档。 */}
            <div className={TOOL_GRID}>
              {moreTools(tool.slug, 18).map((t) => (
                <ToolMiniCard tool={t} key={t.slug} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
