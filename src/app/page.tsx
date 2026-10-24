import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, ConciergeBell, LayoutGrid, Link2, Rocket } from 'lucide-react';
import { Hero } from '@/components/hero';
import { HomeDecideStrip } from '@/components/home-decide-strip';
import { HomeNews } from '@/components/home-news';
import { HomeCollections } from '@/components/home-collections';
import { CategoryIcon } from '@/components/category-icon';
import { SectionHeader } from '@/components/section-header';
import { TOOL_GRID, ToolMiniCard } from '@/components/tool-card';
import { cardFromTool } from '@/lib/card-server';
import { InlineStats } from '@/components/home-stats';
import { friendLinks, hotTools, newestTools, sections, SITE, tools, toolsByCategory } from '@/lib/data';
import type { Tool } from '@/lib/types';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';
import { rgb, rgbAlpha } from '@/lib/utils';

/**
 * The home page needs its own metadata block purely for `alternates.canonical`,
 * which is the one path every other route on the site now carries. `title` and
 * `description` are restated from `SITE` because a page-level block overrides
 * the layout's inherited values wholesale — omitting them would drop the
 * description and the keywords-adjacent fields from `/` only.
 */
export const metadata: Metadata = withOg(
  {
  ...canonical("/"),
  title: SITE.title,
  description: SITE.description,
  },
  '/',
);

/**
 * 首页 26 个分类区块的四段分组。
 *
 * 为什么需要分组：26 个区块原先等距平铺，每屏结构完全相同，滚动时没有任何
 * 位置感（见 `page.tsx` 主体里的长注释）。分组本身不引入新数据 —— 它只是
 * 把 `sections.json` 的 26 项按语义归到四个「你想做什么」的段落里，
 * 组内仍严格保持原数组顺序。
 *
 * 归类依据是「动作」而不是「技术」：创作 / 信息 / 效率 / 生意。
 * 这样分组后，读者找「写东西的工具」在第一段，找「查资料」在第二段，
 * 找「办公提效」在第三段，找「赚钱相关」在第四段 —— 与站点首页
 * 「按你想做什么分成 26 个场景」的定位一致。
 *
 * 约束：四个数组的并集必须恰好等于 `sections.json` 的全部 26 个 slug。
 * `tests/app-shell.test.mjs` 里有一条用例守着这点（漏一个分类首页就少
 * 一整个区块，且不会报错）。
 */
const CATEGORY_GROUPS: { id: string; title: string; note: string; slugs: string[] }[] = [
  {
    id: 'create',
    title: '创作与表达',
    note: '写作、图像、视频、音频 —— 把想法变成作品',
    slugs: [
      'ai-writing',
      'ai-image-design',
      'ai-video-animation',
      'ai-audio-music',
      'ai-ppt',
      'ai-mindmap-whiteboard',
    ],
  },
  {
    id: 'research',
    title: '检索与研究',
    note: '搜索、分析、读文献 —— 先看清楚再动手',
    slugs: [
      'ai-search-engine',
      'ai-data-analysis',
      'ai-browser',
      'ai-academic-tools',
      'ai-content-detection',
    ],
  },
  {
    id: 'work',
    title: '办公与效率',
    note: '对话、记录、写代码、搭站点 —— 日常工作的手脚',
    slugs: [
      'ai-agents',
      'ai-chatbots',
      'ai-coding',
      'ai-document-tools',
      'ai-notetaker',
      'ai-website-builder',
      'ai-translation-tools',
      'ai-learning-tools',
      'ai-prompt-tools',
      'ai-cloud-platforms',
    ],
  },
  {
    id: 'business',
    title: '生意与专业',
    note: '营销、招聘、法务、金融、客服 —— 面向经营的场景',
    slugs: [
      'ai-marketing-sales',
      'ai-recruiting-tools',
      'ai-customer-support',
      'ai-finance-tools',
      'ai-lawer-tools',
    ],
  },
];

/** The origin's phone-only "browse everything" button, verbatim (chunk `62:`). */
const BROWSE_ALL_CLASS =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 shadow h-9 px-4 py-2 bg-gongke-dark text-white hover:bg-gongke-dark/90 w-full sm:w-auto';

/**
 * The origin's mini card, which is what every grid on this page uses. `emphasis`
 * exists because the sections do not share one hover shadow: 最新添加 is the
 * only one that lifts to `shadow-md`; 热门工具 and all 26 category sections use
 * `shadow-sm`. Counted directly out of the flushed SSR HTML — 10/10, 7/7 and
 * 5/5 cards respectively, with no exceptions.
 */
function Grid({ items, emphasis = false }: { items: Tool[]; emphasis?: boolean }) {
  // 列数交给 `TOOL_GRID`（最小轨道 280px，1440 四列 / ≥1800 五列）。
  // 原先这里写死 `xl:grid-cols-4 2xl:grid-cols-5`，1440 下是 300px 的卡、
  // 1536 下反而缩到 240 —— 宽屏越大卡越小。现在卡片宽度只随容器微调。
  //
  // 条数与列数：热门 10 条在 4 列下是 4+4+2、5 列下是 2×5；最新 24 条在
  // 4 列下整整 6 行、3 列下 8 行、5 列下 4 行 + 4 —— 任何宽度都不会只落
  // 单张卡在末行。原先取 25 条时，1440 与 1280 的末行都只剩一张。
  //
  // **必须过 `cardFromTool()`**：裸 `Tool` 里没有价格档位、平台、更新时间
  // （它们都在 14 MB 的 `tool-extras.json` 里），直接传给卡片会让底部那一行
  // 「可比较的事实」整块不渲染。2026-10-22 之前只有详情页的 rail 做了转换，
  // 首页 / 26 个分类页 / 9 个集合页 / 详情页「更多AI工具」全都漏了 ——
  // 同一张 Lovart 卡在 `/tools` 有「Web · iOS +1 · 1 个月前更新」，
  // 在首页、分类页、集合页没有，读者会以为是自己看错了。
  //
  // 成本为零：`cardFromTool` 是 server-only，这些页面本来就是 server component
  // 且已在读 `@/lib/data`，不新增客户端 bundle。
  return (
    <div className={TOOL_GRID}>
      {items.map((t) => (
        <ToolMiniCard key={t.id} tool={cardFromTool(t)} emphasis={emphasis} />
      ))}
    </div>
  );
}

export default function HomePage() {
  // The origin's home page is one <section> holding four things in order: the
  // hot rail, the newest rail, 26 category rails, then the phone-only button —
  // with the friend-links strip after all of it, outside the section. The two
  // rails are harvested slug lists (data/home-rails.json) rather than a slice
  // of the catalog: 热门工具 is a hand-picked 10 and 最新添加 is 25, and neither
  // is derivable from tools.json's order.
  return (
    <>
      <Hero />

      {/* 决策条：hero 之下、热门工具之上的一条细带（2026-10-23）。
          首页原来的两个 CTA 都指向「浏览」（全部工具 / AI 资讯），
          `/decide` 只有导航里一个入口 —— 一个能把「翻目录」转成「做决定」的
          入口，值得在首屏之后立刻出现一次。它刻意做得很薄，不是第二个 hero。 */}
      <HomeDecideStrip />

      {/* hero 与第一段内容之间不留 4px 的缝：墨块结束就是纸面，工具网格直接
          接上，中间的 48px 由网格自己的 `pt-10` 给。 */}
      <section className="bg-background pb-4 pt-10">
        <div className="content-container">
          <div className="mb-12">
            <SectionHeader
              title="热门工具"
              href="/tools"
              linkLabel="查看全部"
              icon={<Rocket className="h-4 w-4" />}
            />
            {/* 移动端：体量数字从 hero 搬到这里（`md:hidden`）。
                读者此时已经看到工具卡了，数字变成「证明这站很大」而不是
                「挡住我看工具」—— hero 里它在 390×844 下把第一张卡推到
                top 773（屏高 844，只露 71px）。见 `home-stats.tsx`。 */}
            <div className="mb-3 mt-2 md:hidden">
              <InlineStats />
            </div>
            <Grid items={hotTools} />
          </div>

          {/* 最新添加 has no "查看更多" control on the origin — it is the only
              home-page section that leads nowhere, so no href is passed here. */}
          <div>
            <SectionHeader
              title="最新添加"
              icon={<ConciergeBell className="h-4 w-4" />}
            />
            <Grid items={newestTools.slice(0, 24)} emphasis />
          </div>
        </div>
      </section>

      {/* 编辑精选：9 个集合原先全站 0 内链（只有 sitemap 能到），而它们正好
          对应「第一次来、不知道选哪个」的需求。放在「最新添加」之后、
          资讯之前：读者先看到量大（2081）、再看到上新，然后是少而精的选择。 */}
      <HomeCollections />

      {/* 资讯插在「工具发现」与「按分类逛」之间：读者已经看过热门与上新，
          接下来要么去逛分类、要么看行业动态，资讯在这里是第二个自然的出口。
          顺序改动见 `home-news.tsx` 顶部注释。 */}
      <HomeNews />

      {/* ── 26 个分类：按使用场景分四组的**索引**，不再铺开 26 面卡墙 ──────
          2026-10-18 重构。原先是 26 个区块各铺一整个网格（每类 19–60 条），
          2560 实测这一节高 38,833px —— 相当于 30 个视口。读者滚过第一组之后
          每一屏长得完全一样，四段分组的意义被稀释成零，而且首页 HTML 因此
          长到 4.6 MB、首屏要解码 1285 张工具图标。

          现在这里只回答一个问题：「有哪些场景」。每一类给一张紧凑的索引
          条（图标 + 名称 + 收录数），点进去才是该类的全部工具。全站工具总量
          在标题旁与结尾按钮各出现一次，读者不会以为目录变小了。

          四段分组原样保留，且仍严格沿用 `sections.json` 的顺序（组内按它
          过滤，不重排）；`<Link prefetch={false} id={slug}>` 保证 `#ai-agents` 这类既有锚点
          依然落在首页上（`tests/app-shell.test.mjs` 守着这一点）。 */}
      <section className="border-t border-foreground/[0.07] bg-foreground/[0.02] pb-14 pt-12 md:pt-14">
        <div className="content-container">
          <header className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
                按场景浏览
              </p>
              <h2 className="font-display text-[26px] leading-tight text-foreground md:text-[30px]">
                从你想做的事开始
              </h2>
              <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-gongke-muted">
                {sections.length} 个场景、{tools.length} 个工具。按用途归到四个方向，
                点进任意一类看到该场景下收录的全部工具。
              </p>
            </div>
            <Link prefetch={false}
              href="/categories"
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3.5 py-2 text-[13px] font-medium text-foreground/80 transition-all duration-200 hover:-translate-y-px hover:border-foreground/25 hover:text-foreground"
            >
              分类总览
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </header>

          {CATEGORY_GROUPS.map((group) => {
            const items = sections.filter((s) => group.slugs.includes(s.slug));
            if (items.length === 0) return null;
            return (
              <div key={group.id} className="mt-12 first:mt-0">
                <div className="mb-4 flex items-end gap-4 border-b border-foreground/10 pb-2.5">
                  <div className="min-w-0">
                    <h3 className="font-display text-[20px] leading-tight text-foreground">
                      {group.title}
                    </h3>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{group.note}</p>
                  </div>
                  <span className="mb-0.5 ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {items.length} 个分类
                  </span>
                </div>

                {/* 索引条用**居中的弹性换行**，而不是 `grid` 固定列数。
                    固定列数在这里必然留洞：四组分别是 6 / 5 / 10 / 5 条，
                    没有任何一个列数能让四组都不出现「最后一行只剩一格」——
                    1440 下 6→4+2、5→4+1、10→4+4+2、5→4+1，四组各挂一块
                    缺角，滚过去像排版没做完（这是「排版粗糙」最集中的一处）。
                    改成内容自适应宽度的弹性行后，每一行的条目数由可用宽度
                    决定，末行居中收尾 —— 参差是云团的收边，不是漏排的空格。
                    手机上仍然是整行一条（`w-full`）。 */}
                <div className="flex flex-wrap justify-center gap-2">
                  {items.map((s) => (
                    <Link prefetch={false}
                      key={s.slug}
                      id={s.slug}
                      href={`/categories/${s.slug}`}
                      className="group flex w-full scroll-mt-24 items-center gap-3 rounded-xl border border-foreground/10 bg-card px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md hover:shadow-foreground/[0.05] active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:grow sm:basis-[12.5rem] 4xl:basis-[17.5rem]"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-foreground/5 transition-transform duration-200 group-hover:scale-105"
                        style={{
                          background: rgbAlpha(s.color, 0.07),
                          color: rgb(s.color),
                        }}
                      >
                        <CategoryIcon name={s.icon} className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold leading-snug text-foreground transition-colors group-hover:text-gongke-accent">
                          {s.name}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] tabular-nums text-muted-foreground">
                          {toolsByCategory(s.slug).length} 个工具
                        </span>
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 shrink-0 text-foreground/20 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gongke-accent"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link prefetch={false} href="/tools" className={BROWSE_ALL_CLASS}>
              浏览全部 {tools.length} 个工具
            </Link>
            <Link prefetch={false}
              href="/categories"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground md:hidden"
            >
              查看所有分类
            </Link>
          </div>
        </div>
      </section>

      {/* Last element in the origin's body — the `$RS("S:2","P:2")` flush lands
          immediately after it, and P:1/P:2 are the shell's document-order
          placeholders, so nothing follows. */}
      <div className="hidden text-sm text-muted-foreground md:mt-4 md:block">
        <div className="content-container flex flex-wrap items-center gap-2">
          <Link2 className="h-4 w-4" />
          <span>友情链接</span>
          {friendLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              {l.name}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
