import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Flame,
  LayoutGrid,
  Layers2,
  Newspaper,
  Sparkles,
} from 'lucide-react';
import { SITE, allCategories, tools } from '@/lib/data';
import { dailyArchive, hotTopics, latestDaily } from '@/lib/daily-data';
import { dailyStats, formatDateFull, issueNumber, weekdayZh } from '@/lib/news-period';
import { SiteLogo } from './site-logo';

/**
 * 首页 hero。
 *
 * 2026-10-17 重做。原来的 hero 是「一行小圆标 + 巨大站名 + 两段文字 + 两个
 * 按钮」，全部左对齐、全部同一种灰绿色，读完后没有任何视觉记忆点 —— 用户
 * 的原话是「没有设计感、整体质感不够高级」。而且它和下面的工具网格连成
 * 一整片骨白，首屏没有边界。
 *
 * 现在是一块**墨色横幅**（`.ink-band`）：深墨绿底、极淡的网格与两侧光晕，
 * 与骨白纸面形成整页唯一的强对比区域。里面分三层：
 *
 *   1. 左：栏目标签 + 站名 + 一句定义 + 两个 CTA；
 *   2. 右：**今日速览** —— 最新一期日报的头条、此刻最热一条、最近的周报/月报，
 *      让读者在首屏就看到「今天 AI 圈发生了什么」，而不是先做一次导航；
 *   3. 底：站点体量的四个数字（收录工具 / 分类 / 日报期数 / 集合）。
 *
 * 右侧速览在 `xl` 以下收起，墨块变成单栏 —— 手机上首屏的高度预算只够
 * 「是什么 + 去哪看」，塞三张卡片会把 CTA 推走。
 *
 * 文案沿用原站 hero 的措辞（这是站点自身文案，不是抓取内容），只换品牌名。
 */

/** 墨底上的主按钮：骨白实心，hover 微微提亮并上浮。 */
const CTA_PRIMARY =
  'group inline-flex items-center gap-2 rounded-full bg-[#F2EEE6] px-5 py-2.5 text-sm font-semibold text-[#1B2523] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2EEE6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B2523]';

/** 墨底上的次按钮：一圈半透明描边，不抢主按钮。 */
const CTA_SECONDARY =
  'group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-[#F2EEE6]/85 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.08] hover:text-[#F2EEE6] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2EEE6]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B2523]';

/** 速览卡的统一外壳：深一档的墨色 + 极淡描边，层次靠明度而不是阴影。 */
const BRIEF_CARD =
  'group flex flex-col rounded-xl border border-white/10 bg-white/[0.045] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075] active:translate-y-0 active:scale-[0.995]';

export function Hero() {
  const daily = latestDaily();
  const hot = hotTopics[0];
  const hotCount = hotTopics.length;
  // 宽屏主卡的补充条目。日报的 lead 同时是第一个栏目里的第一条，
  // 不过滤就会在标题正下方重复同一句话。
  const leadTitle = daily?.lead?.title?.trim();
  const dailyPicks = daily
    ? daily.sections
        .flatMap((s) => s.items)
        .filter((it) => it.title.trim() !== leadTitle)
        .slice(0, 4)
    : [];
  const dailyTotal = daily ? dailyStats(daily).items : 0;
  const stats = [
    { value: tools.length, label: '收录工具', unit: '个' },
    { value: allCategories.length, label: '分类', unit: '个' },
    { value: dailyArchive.length, label: '日报', unit: '期' },
    { value: hotCount, label: '此刻热点', unit: '条' },
  ];

  return (
    <section className="ink-band" aria-labelledby="hero-heading">
      <div className="content-container py-12 md:py-16 lg:py-20">
        {/* 2026-10-17 第二次修正：宽屏下左右两栏**不再等分**。
            实测 2560：容器 1696，1.05fr/0.95fr 给出左 861 / 右 779，但左栏
            实际内容（站名、定义、CTA、stats）只用到 512 —— stats 的
            `max-w-lg` 把整栏钉在了 512，剩下 349px 是空的；右栏的速览卡
            只有 232px 高，却被 `items-center` 居中在一个 406px 高的行里，
            上下各空 87px。两边一起看就是「左疏右空、上下漏气」。

            现在：左栏封顶 34rem（544px，正好容下 4 个 stats 的舒适行宽），
            右栏吃掉剩余宽度并 `items-stretch`；速览卡组用 `flex-1` 撑满行高，
            其中「今日日报」主卡再 `flex-1`，于是它是真正的主卡而不是与另两张
            等高的方块。stats 移到两栏之外、横跨全宽，成为 hero 的落地基线。
            `xl:` 以下仍是单栏，不受影响。
            2026-10-18：两栏的启用点从 `lg` 提到 `xl` —— 1024–1279 下容器
            扣掉 192px 侧栏只剩 768px，右栏被挤成 168px 竖条，卡片标题裁到
            只剩两三个字。1280 起右栏 400px，才读得下去。 */}
        <div className="grid gap-10 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] xl:items-stretch xl:gap-20">
          {/* ── 左：定位 ─────────────────────────────────────────── */}
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-[#F2EEE6]/70">
              <Sparkles className="h-3 w-3 text-[#F2A07F]" aria-hidden="true" />
              TRYWORLD · AI 工具与智能体导航
            </p>

            {/* 字号阶梯到 56px 就断了：1760 的容器里，左栏 544 的站名停在
                56px，与右栏 759 的主卡同处一个尺度，宽屏下整块墨带缺少
                「抬头」的体量。≥1800 补到 64、≥2100 补到 72（四个字 288px，
                连图标仍在 544 栏内），右栏主卡不变 —— 差距一拉开，墨带才有
                了标题。 */}
            <h1
              id="hero-heading"
              className="mt-5 flex items-center gap-3 font-display text-4xl leading-none text-[#F2EEE6] sm:text-5xl lg:text-[56px] 4xl:text-[64px] 5xl:text-[72px]"
            >
              <SiteLogo className="h-auto w-10 shrink-0 text-[#F2EEE6] sm:w-12 5xl:w-14" />
              <span>{SITE.name}</span>
            </h1>

            <p className="mt-5 max-w-[22ch] text-balance font-display text-2xl leading-snug text-[#F2EEE6]/90 sm:max-w-none sm:text-[30px] 5xl:text-[34px]">
              工欲善其事，必先利其器。
            </p>
            {/* 不设 `max-w-[52ch]`：52ch 在 15px 下只有 433px，左栏 544 里
                右侧空出 111px，这段引文的右缘与下面 CTA 行的右缘对不上。
                栏宽本身就是行宽（544px ≈ 36 个汉字，远在舒适线内）。

                `text-balance`：这段话在 1024（左栏 768）和 1440 左栏（544）
                下都会折成两行，末行只剩「么。」两个字。均衡换行把两行拉平，
                避免墨底上出现一个孤零零的短行。 */}
            {/* `text-balance` 只均衡行长，不管标点：390px 下「按「你想做什」
                /「么」分成」会在引号中间断开，把一个完整的口语短语劈成两半
                （截图见 work/launch-shots/home-390.png）。中文排版里引号
                短语应当整体换行，所以这里给「你想做什么」加 nowrap，
                让断点落在「按」之后。 */}
            <p className="mt-3 text-balance text-[15px] leading-relaxed text-[#F2EEE6]/60">
              <span className="whitespace-nowrap">{tools.length} 个</span> AI 工具与智能体，按
              <span className="whitespace-nowrap">「你想做什么」</span>分成{' '}
              <span className="whitespace-nowrap">{allCategories.length} 个场景</span>；每天还有一期 AIHOT 精选日报，告诉你圈里发生了什么。
            </p>

            {/* CTA 主次在 2026-10-18 对调。
                原文是「看今天的 AI 资讯」占实心白（主），「浏览全部工具」描边（次）——
                一个 AI 工具导航站，把首屏唯一的主按钮给了另一个产品（资讯），
                访客读完 hero 的第一反应应该是「去哪找工具」，而不是「去看新闻」。
                现在主按钮 = 浏览全部工具，资讯降为次按钮（仍保留 testid，
                既有测试与埋点不用改）。 */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/tools" className={CTA_PRIMARY}>
                <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                浏览全部工具
                <ArrowRight
                  className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link href="/news" className={CTA_SECONDARY} data-testid="news-hero-cta">
                <Newspaper className="h-4 w-4 shrink-0" aria-hidden="true" />
                看今天的 AI 资讯
              </Link>
            </div>

          </div>

          {/* ── 右：今日速览 ─────────────────────────────────────── */}
          {/* `h-full` + `flex flex-col`：宽屏下让这一栏撑满左栏的高度，卡片
              组用 `flex-1` 吃掉剩余空间，日报卡再 `flex-1` —— 于是「今日日报」
              变成一块真正的**主卡**（而不是和另外两张一样高的小方块），
              整栏右缘与左栏的 CTA 行对齐。窄屏（`xl` 以下）整块隐藏。

              2026-10-17 第三次修正：`4xl`（≥1800）起右栏自己再拆两列。
              容器放到 1760 后，左栏封顶 544，右栏就吃掉 1073 —— 一张只有
              标题和两行摘要的卡片铺满 1073，右半边全是空气。现在 `4xl`
              下右栏变成 `[日报 1fr | 热点/分类 19rem]`：
              日报卡 759、右侧竖排两张 304，与左栏的 544 形成
              544 / 759 / 304 的三段节奏，hero 横向不再有一块空白。
              实现上用 `display:contents` 把卡片组「溶解」成右栏的 grid item，
              所以 DOM 结构不变、`xl`–`3xl` 的 flex 行为也不变。 */}
          <div className="hidden min-w-0 xl:flex xl:h-full xl:flex-col 4xl:grid 4xl:grid-cols-[minmax(0,1fr)_19rem] 4xl:grid-rows-[auto_minmax(0,1fr)] 4xl:gap-2.5">
            <div className="mb-3 flex items-center justify-between 4xl:col-span-2 4xl:mb-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#F2EEE6]/55">
                今日速览
              </p>
              {daily && (
                <p className="flex items-center gap-1.5 text-[11px] text-[#F2EEE6]/55">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {formatDateFull(daily.date)} · {weekdayZh(daily.date)}
                </p>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2.5 4xl:contents">
              {daily && (
                <Link
                  href={`/news/daily/${daily.date}`}
                  className={`${BRIEF_CARD} min-h-0 flex-1 4xl:col-start-1 4xl:row-start-2`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F2A07F]">
                    <Newspaper className="h-3 w-3" aria-hidden="true" />
                    今日日报 · 第 {issueNumber(dailyArchive, daily.date)} 期
                  </span>
                  <span className="mt-1.5 line-clamp-2 font-display text-[17px] leading-snug text-[#F2EEE6] transition-colors group-hover:text-white">
                    {daily.lead?.title ?? '今日无大事发生'}
                  </span>
                  {daily.lead?.leadParagraph && (
                    <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#F2EEE6]/60">
                      {daily.lead.leadParagraph}
                    </span>
                  )}
                  {/* ≥1800 时主卡被撑到 268px 高、字只占上面 68px，下三分之二
                      是空盒。补三条本期条目，它才配得上「主卡」的体量。 */}
                  <span className="mt-2.5 hidden flex-col 4xl:flex">
                    {dailyPicks.map((it) => (
                      <span
                        key={it.title}
                        className="line-clamp-1 border-t border-white/10 pt-1.5 text-[12px] leading-snug text-[#F2EEE6]/55 first:border-t-0 first:pt-0"
                      >
                        {it.title}
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto hidden pt-2.5 text-[11px] text-[#F2EEE6]/55 4xl:block">
                    查看今日全部 {dailyTotal} 条 →
                  </span>
                </Link>
              )}

              <div className="grid shrink-0 grid-cols-2 gap-2.5 4xl:col-start-2 4xl:row-start-2 4xl:grid-cols-1 4xl:grid-rows-2">
                {hot && (
                  <Link href="/news/hot" className={BRIEF_CARD}>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F2A07F]">
                      <Flame className="h-3 w-3" aria-hidden="true" />
                      此刻最热
                    </span>
                    <span className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-[#F2EEE6]/90">
                      {hot.title}
                    </span>
                    <span className="mt-auto pt-2.5 text-[11px] text-[#F2EEE6]/55">
                      {hot.sourceCount} 家来源在讨论
                    </span>
                  </Link>
                )}
                <Link href="/categories" className={BRIEF_CARD}>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F2A07F]">
                    <Layers2 className="h-3 w-3" aria-hidden="true" />
                    按场景找
                  </span>
                  <span className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-[#F2EEE6]/90">
                    写作、编程、图像、视频、办公、研究……按你想做的事开始
                  </span>
                  <span className="mt-auto flex items-center gap-1 pt-2.5 text-[11px] text-[#F2EEE6]/55 transition-colors group-hover:text-[#F2EEE6]/70">
                    {allCategories.length} 个分类
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── 底：体量数据带 ─────────────────────────────────────── */}
        {/* 原先把 stats 放在左栏内、`max-w-lg` 封顶 —— 宽屏下它把整栏钉在
            512px，右栏于是空出一大片。现在它横跨两栏，成为 hero 的落地基线：
            四个数字均匀分布在全宽上，左缘仍与站名对齐。 */}
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-4 lg:mt-12">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[11px] tracking-wide text-[#F2EEE6]/60">{s.label}</dt>
              <dd className="mt-0.5 font-display text-2xl tabular-nums text-[#F2EEE6]">
                {s.value}
                <span className="ml-1 text-sm text-[#F2EEE6]/55">{s.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
