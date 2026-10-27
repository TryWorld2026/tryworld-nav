import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { collections } from '@/lib/data';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical("/collections"),
  title: '精选AI利器集合',
  description: '试界导航精选AI工具集合，AI助力提效，让你事半功倍。',
  },
  '/collections',
);

/**
 * 集合总览。
 *
 * 2026-10-17 重做。原来标题用原站的紫粉渐变文字（`#ffaa40 → #9c40ff`），
 * 与试界「禁紫色」的品牌约束直接冲突，而且页面没有内容容器、9 张卡片被拉成
 * 2xl 下的 5 列 —— 每张卡只有 230px，标题折成两行、成员图标挤成一团。
 *
 * 现在：
 *   - 标题回到品牌深绿，`italic` 的 Fraunces 只用在英文点题上，中文标题不用叠影；
 *   - 卡片改用与站内一致的 2 列/3 列/4 列网格，标题 17px，成员图标 32px；
 *   - 每张卡保留原站的「六个成员图标」结构，但加一层分类色的极淡底晕，让
 *     九张卡在扫读时能靠颜色区分，而不是九块一模一样的白。
 *
 * 2026-10-18：集合一共 9 个，`xl:grid-cols-4` 会排成 4+4+1 —— 末行孤卡挂在
 * 左上，右边三格全空，这是「宽屏布局塌陷」的典型长相。9 恰好是 3 的倍数，
 * 所以 1440 起固定 3 列（3×3 方阵），只在 4xl（1800，容器 1800 宽）才放 5 列
 * （5+4，末行只差一格，视觉上不散）。2xl–4xl 之间保持 3 列、卡片 437px，
 * 比 4 列的 317px 更从容。
 */
export default function CollectionsPage() {
  return (
    <div className="content-container py-10 md:py-12">
      <header className="mb-8 md:mb-10 4xl:mb-12">
        {/* 集合数并进眉标。原先它单独挂在标题行右侧（`justify-between`），
            1440 下被推到容器最右，与标题隔开 600px 空白，既不像副标题也不像
            度量衡，像是页面上的残留。基数很小（9），放进眉标读起来更顺。 */}
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          编辑精选 · <span className="tabular-nums">{collections.length} 个集合</span>
        </p>
        <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl 4xl:text-6xl 4xl:leading-tight">
          精选AI利器集合
        </h1>
        {/* 一行写完：JSX 在 `，` 后换行会插进一个空格，中文里等于凭空多出
            半个字。56ch 在 15px 下只有约 470px，这句话会被折成两行、末行只剩
            「完整名单。」；放宽到 40em 后 2560 下也是一行。
            2026-10-18 实测：这句话自然宽 611px，而 40em = 600px —— 差 11px 就
            刚好折成第二行，末行只有一个「单」字，比原先 56ch 还难看。改成
            41em（615px）才真的一行；窄屏（≤768）仍然折行，所以配 `text-balance`
            把两行拉平。

            2026-10-22 措辞校正：原文「每个集合六个代表工具，点进去是完整名单」
            承诺的是**六张工具卡**，而卡片上实际给的是**六个成员图标**（无名称、
            无简介）。图标确实是六个代表工具的图标，所以这句话不算假，但它让
            读者以为能在这页看到六个带名字的工具 —— 实测读者第一反应是「卡呢」。
            改成如实描述「六个成员图标」，并保留「点进去是完整名单」这个出口。

            为什么**不加**54 张卡（9 × 6）：这一页的职责是「挑一个集合进去」，
            不是「在集合里挑工具」。铺 54 张卡会把它变成第二个 `/tools`，而
            「九个集合各是什么」这件事会被卡海淹掉。真要比较工具，每个集合页
            里已经是完整名单 + 全站卡片。 */}
        <p className="mt-2 max-w-[41em] text-balance text-base leading-relaxed text-gongke-muted">
          按公司、按场景、按使用人群整理的工具清单。每张卡上是六个成员图标与收录总数，点进去是完整名单。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 4xl:grid-cols-5">
        {collections.map((c) => (
          <Link prefetch={false}
            key={c.slug}
            href={`/collections/${c.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 active:scale-[0.995]"
          >
            {/* 底晕常驻而不是只在 hover 出现：九张卡平铺时原来是一模一样的
                九块白，扫读时没有任何可抓的结构。常驻一档很淡的绿（0.05 ×
                0.7 ≈ 0.035）就够把「卡片是块面」这件事说出来，hover 再推到满。 */}
            <span
              className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  'radial-gradient(120% 80% at 0% 0%, rgba(36,86,78,0.05), transparent 60%)',
              }}
              aria-hidden="true"
            />
            <div className="relative flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-foreground/[0.035] ring-1 ring-inset ring-foreground/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.tagIcon}
                  alt=""
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  className="h-8 w-8 object-contain"
                />
              </span>
              <ArrowUpRight
                className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gongke-accent"
                aria-hidden="true"
              />
            </div>

            <h2 className="relative mt-3 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-gongke-accent">
              {c.title}
            </h2>
            {/* `min-h-[42px]` = 13px × 1.6 × 2 行。集合简介有一行的也有两行的，
                不锁高度时同一网格里两种卡的内容起点会差 21px（成员图标被
                `mt-auto` 压到底，于是中间那段留白忽宽忽窄，九张卡看起来
                像两套模板）。 */}
            <p className="relative mt-1 line-clamp-2 min-h-[42px] text-sm leading-relaxed text-gongke-muted">
              {c.description}
            </p>

            {/* 成员图标条：最多六个，尺寸固定，所以六工具集合与二十工具集合
                渲染出同样的卡高。 */}
            <div className="relative mt-auto flex flex-wrap items-center gap-1.5 pt-4">
              {c.memberIcons.slice(0, 6).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  decoding="async"
                  className="h-7 w-7 rounded-md bg-foreground/[0.035] object-contain p-0.5 ring-1 ring-inset ring-foreground/5"
                />
              ))}
              {/* 数据里每个集合正好六个成员图标，`+N` 只是防御 —— 采集端哪天
                  给出更多切片时不会悄悄丢。 */}
              {c.memberIcons.length > 6 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  +{c.memberIcons.length - 6}
                </span>
              )}
              {/* 集合的规模是这张卡最该被比较的数字（六个代表图标长得都差不多），
                  原来页面上完全没有它。贴右侧、与图标条同基线，扫读时一眼就能
                  区分「六个工具」和「二十个工具」。 */}
              <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">
                {c.toolCount} 个工具
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
