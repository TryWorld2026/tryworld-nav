import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Layers2 } from 'lucide-react';
import { CategoryIcon } from '@/components/category-icon';
import { categoryCards, tools, toolsByCategory } from '@/lib/data';
import { rgb, rgbAlpha } from '@/lib/utils';
import { canonical } from '@/lib/canonical';

/**
 * The origin's own `<title>`, description and keywords, harvested from
 * /categories rather than derived — the page copy is hand-written.
 */
export const metadata: Metadata = {
  ...canonical("/categories"),
  title: '所有分类',
  description:
    '试界导航是专注于智能体和AI工具的门户网站，我们致力于为用户介绍最新、热门的智能体和AI工具，帮助用户快速找到适合自己的学习、工作、生活的AI利器。浏览我们的精选分类，找到适合您需求的智能体或AI工具。',
};

/**
 * 分类总览。
 *
 * 2026-10-17 重做。原来是一句标题 + 26 张白底卡片，卡片的底色与页面底色几乎
 * 同色，整页像一张没有网格线的 Excel —— 用户的原话「没有设计感、排版粗糙」。
 *
 * 现在的做法：
 *   - 顶部加一条**按分类色着色的索引带**（26 个色块，每个是一个分类的色相），
 *     它同时是整页的视觉标题和快速跳转；颜色取自 `category-cards.json` 里
 *     每个分类自己的 `color`，不是另造一套；
 *   - 卡片本身加实色 hairline、hover 上浮 + 分类色描边，图标块放大到 48px
 *     并保留原站的 0.05 底色（这一处是原站的事实，不改成 0.12）；
 *   - 成员头像给一圈骨白描边（`ring-2 ring-background`），叠在一起时不糊成
 *     一片；「+N」圆钮从纯黑改成墨绿，和站内动作色一致。
 */
export default function CategoriesPage() {
  return (
    <div className="content-container py-10 md:py-12">
      <header className="mb-8 md:mb-10">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Layers2 className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
          按场景浏览
        </p>
        {/* 标题右侧的计数是这一页唯一的「大数字」。
            2560 下 h1 只占 200px 宽，右边 1200 多像素全空着 —— 一页的第一屏
            除了标题什么都没有。把两个口径（场景 / 工具）提成独立的数字块，
            右缘与下面的卡片列对到同一条线上。
            计数从描述句里搬出来：同一组数字在一屏里写两遍会显得没整理过。 */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl 4xl:text-5xl 4xl:leading-[1.1]">
              所有分类
            </h1>
            {/* 一句话的 <p> 必须写成一行。JSX 在 `，` 与 `而不是` 之间换行时
                会插进一个空格（中文里等于多出半个字宽的洞），而且 52ch 的
                上限在 15px 下只有约 437px，这句话会折成两行、末行只剩三四个字。 */}
            <p className="mt-2 max-w-[36em] text-[15px] leading-relaxed text-gongke-muted">
              按你想做的事开始，而不是按它用了什么技术开始。
            </p>
          </div>
          <div className="flex shrink-0 items-baseline gap-6 md:gap-8 md:border-l md:border-foreground/10 md:pl-8">
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl leading-none tabular-nums text-foreground md:text-3xl">
                {categoryCards.length}
              </span>
              <span className="text-xs text-muted-foreground">个场景</span>
            </p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl leading-none tabular-nums text-foreground md:text-3xl">
                {tools.length}
              </span>
              <span className="text-xs text-muted-foreground">个工具</span>
            </p>
          </div>
        </div>

        {/* 分类色索引带：一眼看到整站的颜色分布，也是页内锚点。
            手机上隐藏：26 个 chip 在 390 宽是 5 行、174px，第一张分类卡被推到
            549px，首屏一张都看不到 —— 而它提供的跳转在手机上本来就用不上
            （下面就是完整列表）。md 起才显示，那里是 2 行。 */}
        <ul className="mt-6 hidden flex-wrap gap-1.5 md:flex" aria-label="分类快速索引">
          {categoryCards.map((c) => (
            <li key={c.slug}>
              <a
                href={`#${c.slug}`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-2.5 py-1 text-[12px] text-foreground/65 transition-all duration-150 hover:-translate-y-px hover:border-foreground/20 hover:text-foreground"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: rgb(c.color) }}
                  aria-hidden="true"
                />
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </header>

      {/* 列数阶梯：1 / 2 / 3 / 4 / 5，与 /tools 的自动栅格几乎逐档重合
          （1024→2、1280→3、1536→4、1800→5），所以两个目录页在同一个视口下
          的卡片密度是一致的。
          2026-10-18 改过一版：旧的 `lg:grid-cols-3 xl:grid-cols-4` 在
          1024–1280 只给卡片 245px（内宽 203px），而卡片底部那条「6 个头像 +
          +N + N 个工具」需要 269px —— 计数被挤到卡片外面，整页横向溢出
          6px / 14px。现在的阶梯最窄一档是 5 列的 302px（内宽 262px）。 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 4xl:grid-cols-5">
        {categoryCards.map((c) => (
          // ⚠ 这里**不能**用「整卡一个 <Link>、成员头像再套 <Link>」的写法：
          // 锚点嵌套锚点是无效 HTML，浏览器解析时会把外层 <a> 提前闭合，
          // 于是 SSR 的 DOM 与 React 的虚拟树对不上，水合直接报
          // `Minified React error #418`（2026-10-17 用 Playwright 在
          // /categories 上实测到）。改法是卡片本身不包锚点：分类名与
          // 图标区是一个独立的链接，头像各自是链接，用 `group` 让 hover
          // 仍然能联动整卡。
          <div
            key={c.slug}
            id={c.slug}
            className="group relative isolate flex scroll-mt-24 flex-col rounded-2xl border border-foreground/10 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-foreground/[0.04]"
            style={{ ['--cat' as string]: rgb(c.color) }}
          >
            {/* 分类色的极淡底晕，hover 时加深一档：卡片的「色相」只来自这一层，
                文字与描边仍然是中性的，整页不会变成彩色马赛克。
                `-z-10` + 卡片的 `isolate`：让它在卡片自己的层叠上下文里沉到
                内容之下，同时不越出卡片去盖住相邻卡片 —— 没有 `isolate` 时
                `-z-10` 会跑到页面根上下文，盖在背景之上、内容之下，行为随
                父级堆叠上下文变化。
                静止时是 60%（约 4.8% 的实际浓度），hover 才升到 100%
                （8%）。原先这里写 `opacity-0`：26 张卡在静止状态下一模一样
                是纯白的，分类色只在鼠标经过时才出现 —— 触屏上永远看不到，
                而这层色晕本来就是「扫一眼就能按颜色认出分类」的唯一定位
                手段。0.08 的渐变直接铺满又太浓，压到 60% 刚好是「有颜色但
                不抢文字」的一档。 */}
            <span
              className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `radial-gradient(120% 80% at 0% 0%, ${rgbAlpha(c.color, 0.08)}, transparent 60%)`,
              }}
              aria-hidden="true"
            />

            <div className="flex items-start gap-3.5">
              {/* 图标不再是独立链接 —— 分类名的 `after` 伪元素已经铺满整卡，
                  图标区天然可点。保留第二个链接只会让 Tab 停在同一个目标两次。
                  `aria-hidden` 也不必：图标是装饰，语义由标题链接承担。 */}
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-foreground/5 transition-transform duration-200 group-hover:scale-105"
                style={{
                  // The origin tints the tile at 0.05, lighter than the
                  // sidebar's 0.2 — read off its inline style.
                  background: rgbAlpha(c.color, 0.05),
                  color: rgb(c.color),
                }}
              >
                <CategoryIcon name={c.icon} className="h-5 w-5 md:h-6 md:w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-semibold leading-snug text-foreground">
                  {/* 整卡可点：`after` 铺满最近的定位祖先（卡片本体），这是
                      嵌套锚点之外唯一合法的「整卡链接」。头像链接各自抬到
                      z-20 才能拿到点击。 */}
                  <Link
                    href={`/categories/${c.slug}`}
                    className="transition-colors after:absolute after:inset-0 after:z-10 after:content-[''] group-hover:text-gongke-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.name}
                  </Link>
                </h3>
                {/* 4xl（≥1800）一档卡片内宽只有 254px，分类说明的可用宽度
                    约 156px —— 13 个字的 tagline 正好断成 12 + 1，末行留一个
                    「手」字。`text-balance` 把两行拉成 7/6，孤字消失。 */}
                <p className="mt-1 text-balance line-clamp-2 text-[13px] leading-relaxed text-gongke-muted">
                  {c.tagline}
                </p>
              </div>
              <ArrowUpRight
                className="mt-1 h-4 w-4 shrink-0 text-foreground/25 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gongke-accent"
                aria-hidden="true"
              />
            </div>

            <div className="relative mt-auto flex items-center justify-between gap-3 pt-5">
              {/* 成员头像。图标本身带品牌色块，叠在一起会糊成一条彩色带 ——
                  所以每个头像都套一个**白色圆片**（`bg-card` + 发丝描边），
                  圆圈之间只靠叠压露出层次，颜色被框在各自的圆里。
                  最多露 5 个：这一行还要放下「+N」和工具数，最窄的卡片内宽
                  262px，5 个（叠压 8px，含 +N 共 157px）+ 12px 间隔 +
                  58px 计数 = 227px，留 35px 余量；6 个则要 251px，只剩 11px，
                  字体一有差异就会顶出去。露不下的由「+N」接着数。 */}
              <div className="flex -space-x-2">
                {c.members.slice(0, 5).map((m) => (
                  <Link
                    key={m.slug}
                    href={`/tools/${m.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={m.name}
                    className="relative z-20 flex h-8 w-8 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10 transition-transform duration-150 hover:z-30 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="h-5 w-5 rounded-[5px] object-contain"
                      src={m.icon}
                      width={20}
                      height={20}
                      alt={m.name}
                    />
                  </Link>
                ))}
                <span
                  className="relative z-0 flex h-8 items-center justify-center rounded-full bg-foreground/[0.05] px-2 text-[12px] font-medium tabular-nums text-foreground/70"
                  aria-hidden="true"
                >
                  +{c.plus}
                </span>
              </div>
              {/* 工具数用**本站目录**的真实计数（`toolsByCategory`），不是
                  `+N` 徽章那个数 —— 后者是原站自己的目录规模（例如 AI智能体
                  的 +103 合计 109），本站收录 161 个，两者口径不同。 */}
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                {toolsByCategory(c.slug).length} 个工具
              </span>
            </div>
          </div>
        ))}

        {/* 26 张卡在任何列数下都除不尽 —— 3 列剩 2 格、4 列剩 2 格、5 列剩 1 格，
            末行会孤零零挂在左上角，下面一大片空白，整页像是"没写完"。
            补一张收口卡：它自己在每个断点多占几格，把 26 补成整行
            （2 列 +2、3 列 +1、4 列 +2、5 列 +4），同时给一个真正有用的出口 ——
            不想按分类找的人可以直接看全量。
            占 2 格及以上时横排，只占 1 格（3 列那一档）时竖排，否则文字会被
            挤成两行窄条。 */}
        <Link
          href="/tools"
          className="group flex flex-col gap-4 rounded-2xl border border-dashed border-foreground/15 p-5 transition-colors duration-200 hover:border-gongke-accent/40 hover:bg-card md:col-span-2 md:flex-row md:items-center md:justify-between md:gap-6 xl:col-span-1 xl:flex-col xl:items-start xl:justify-between xl:gap-4 2xl:col-span-2 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-6 4xl:col-span-4"
        >
          <div>
            <p className="text-[17px] font-semibold leading-snug text-foreground">
              没找到合适的？
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-gongke-muted">
              跳过分类，直接浏览全部 {tools.length} 个工具。
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-gongke-accent">
            浏览全部工具
            <ArrowUpRight
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      </div>
    </div>
  );
}
