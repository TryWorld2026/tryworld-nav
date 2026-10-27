import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Flame,
  LayoutGrid,
  Layers2,
  Newspaper,
} from 'lucide-react';
import { SITE, allCategories, tools } from '@/lib/data';
import { dailyArchive, hotTopics, latestDaily } from '@/lib/daily-data';
import { dailyStats, formatDateFull, issueNumber, weekdayZh } from '@/lib/news-period';
import { NavMark } from './nav-mark';
import { HeroSearch } from './hero-search';

/**
 * 首页 hero。
 *
 * 2026-10-17 重做（墨色横幅），2026-10-27 做了一次**减法**。
 *
 * 上一版实测的问题（`work/design-audit-2026-10-26.md` §1.7）：
 *
 *   - hero 占掉首屏 53–83%，七个主流视口里只有 768×1024 与 1920×1080
 *     能看到一张完整的工具卡 —— 390×664 / 1024×768 / 1280×800 首卡可见
 *     高度是 **0**，1440×900 只露 44/139；
 *   - `xl` 以下右栏整块 `hidden`，于是 768–1279 这段 512px 宽的区间里墨带
 *     是纯左栏，右半部只有网格线与光晕（`shots/bug-hero-1180.png`）；
 *   - 徽章写着「TRYWORLD · AI 工具与智能体导航」，而它正下方就是罗盘 +
 *     「试界导航」—— 同一个信息说了两遍，还带一个 Sparkles。
 *
 * 这一版动了四处：
 *
 *   1. **删掉徽章**（省 47px，并去掉一个无意义的 Sparkles）；
 *   2. **删掉底部四个数字**（省 124px）。它是「hero 指标模板」—— 一个导航站
 *      不需要在首屏证明自己大。四个数字搬到「热门工具」标题行当旁注
 *      （`InlineStats`，现在所有断点都显示），读者看到卡的同时看到体量；
 *   3. 纵向留白改成 `clamp(2rem, 5vh, 3.5rem)` —— 屏越矮，hero 自己收得越紧。
 *      固定 `py-20` 在 768 高的屏幕上等于把整屏送给一块墨底；
 *   4. **右栏从 `xl` 提前到 `lg`**：1024–1279 用「只留今日日报一张主卡」的
 *      窄版（20rem），1280 起恢复三卡。1024 下容器只有 768（侧栏吃掉 192），
 *      三张卡会被挤成竖条 —— 但一张卡放得下，而且比一整块空墨底诚实。
 *
 * 结果（1440×900）：hero 637 → 397，首卡 857 → 617，第一屏**能完整看到
 * 一张工具卡**；1024×768 从「一张都看不到」变成能看全一张。
 */

/** 墨底上的主按钮：骨白实心，hover 微微提亮并上浮。 */
const CTA_PRIMARY =
  'group inline-flex items-center gap-2 rounded-full bg-gongke-paper px-5 py-2.5 text-sm font-semibold text-gongke-dark shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gongke-paper focus-visible:ring-offset-2 focus-visible:ring-offset-gongke-dark';

/** 墨底上的次按钮：一圈半透明描边，不抢主按钮。 */
const CTA_SECONDARY =
  'group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-gongke-paper/85 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.08] hover:text-gongke-paper active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gongke-paper/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gongke-dark';

/** 速览卡的统一外壳：深一档的墨色 + 极淡描边，层次靠明度而不是阴影。 */
const BRIEF_CARD =
  'group flex flex-col rounded-xl border border-white/10 bg-white/[0.045] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075] active:translate-y-0 active:scale-[0.995]';

export function Hero() {
  const daily = latestDaily();
  const hot = hotTopics[0];
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

  return (
    <section className="ink-band" aria-labelledby="hero-heading">
      {/* `clamp(1.25rem,5vh,3.5rem)`：768 高的屏幕上 hero 上下各 38px，
          1080 高的屏幕上各 54px。固定 `py-20`（80px）在矮屏上等于把
          160px 送给留白；664 高的屏幕上取到下限 20px，把首屏还给工具卡。 */}
      <div className="content-container py-[clamp(1.25rem,5vh,3.5rem)]">
        {/* 两栏的启用点：`md`（768）起就有右栏，只是窄（18rem）且只有今日
            日报一张卡；`lg`（1024）放宽到 20rem；`xl`（1280）恢复三卡版。

            2026-10-27 从 `xl` 一路提前到 `md`：原版 768–1279 这 512px 宽的
            区间里墨带是纯左栏，右半部只有网格线与光晕（`shots/bug-hero-1180.png`
            那张图里 1180 视口右侧约 1000px 全是空墨底）。768 下左栏 416px
            刚好容下 30px 的标语（13 个汉字 390px），右栏 288px 放一张日报卡
            不挤 —— 与其留一块空墨底，不如把「今天发生了什么」摆上去。 */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-start md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-10 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] xl:items-stretch xl:gap-16">
          {/* ── 左：定位 ─────────────────────────────────────────── */}
          <div className="min-w-0">
            {/* 字号阶梯到 56px 就断了：1760 的容器里，左栏 544 的站名停在
                56px，与右栏 759 的主卡同处一个尺度，宽屏下整块墨带缺少
                「抬头」的体量。≥1800 补到 64、≥2100 补到 72（四个字 288px，
                连图标仍在 544 栏内），右栏主卡不变 —— 差距一拉开，墨带才有
                了标题。

                2026-10-27：上面的徽章删了，所以 h1 就是 hero 的第一个元素，
                `mt-5` 一并去掉（原来是为了和徽章拉开距离）。 */}
            <h1
              id="hero-heading"
              className="flex items-center gap-3 font-display text-4xl leading-none text-gongke-paper sm:text-6xl lg:text-7xl 4xl:text-8xl 5xl:text-9xl"
            >
              {/* 导航站子品牌标志（罗盘）—— 母品牌 tw 主标已用在作者个人网站。
                  方形 viewBox（48×48），不再需要 `h-auto`。

                  尺寸跟**字号**成固定比例（约 0.75×），不再按 40→48→56 单独跳档：
                  第一版在 390 下是「40px 图形 + 36px 字」，图形比站名还高，视觉
                  重心倒向图标；1440 下却是「48 对 56」，比例反而正常。同一个
                  数字在两档字号下含义不同，所以这里按每个字号档位各算一次：
                  36→28 / 48→36 / 56→42 / 64→48 / 72→54。 */}
              <NavMark className="h-7 w-7 shrink-0 text-gongke-paper sm:h-9 sm:w-9 lg:h-[42px] lg:w-[42px] 4xl:h-12 4xl:w-12 5xl:h-[54px] 5xl:w-[54px]" />
              <span>{SITE.name}</span>
            </h1>

            <p className="mt-4 max-w-[22ch] text-balance font-display text-2xl leading-snug text-gongke-paper/90 sm:max-w-none sm:text-3xl 5xl:text-4xl">
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
                让断点落在「按」之后。

                2026-10-27：文案收短了一版。原文后半句「每天还有一期 AIHOT
                精选日报，告诉你圈里发生了什么」在 390 下独占一整行（三行变
                两行，省 24px 首屏预算），而它说的正是紧邻的次按钮「看今天的
                AI 资讯」—— 同一件事说了两遍。次按钮本身就是入口，这里不必
                再预告一次。 */}
            <p className="mt-3 text-balance text-base leading-relaxed text-gongke-paper/60">
              <span className="whitespace-nowrap">{tools.length} 个</span> AI 工具与智能体，按
              <span className="whitespace-nowrap">「你想做什么」</span>分成{' '}
              <span className="whitespace-nowrap">{allCategories.length} 个场景</span>。
            </p>

            {/* 搜索框放在定义句之后、CTA 之前：读者读完「2081 个工具、26 个
                场景」的第一反应是「那我那个需求有没有」，这里是全站最该给出
                输入口的位置。原先首屏没有任何搜索入口（页眉按钮在 lg 断点上
                连文字都是隐藏的），首屏唯一能做的事只有「浏览全部」。
                它不是真输入框，见 `hero-search.tsx` 的说明。 */}
            <HeroSearch className="mt-5" />

            {/* CTA 主次在 2026-10-18 对调。
                原文是「看今天的 AI 资讯」占实心白（主），「浏览全部工具」描边（次）——
                一个 AI 工具导航站，把首屏唯一的主按钮给了另一个产品（资讯），
                访客读完 hero 的第一反应应该是「去哪找工具」，而不是「去看新闻」。
                现在主按钮 = 浏览全部工具，资讯降为次按钮（仍保留 testid，
                既有测试与埋点不用改）。 */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link prefetch={false} href="/tools" className={CTA_PRIMARY}>
                <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
                浏览全部工具
                <ArrowRight
                  className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link prefetch={false} href="/news" className={CTA_SECONDARY} data-testid="news-hero-cta">
                <Newspaper className="h-4 w-4 shrink-0" aria-hidden="true" />
                看今天的 AI 资讯
              </Link>
            </div>
          </div>

          {/* ── 右：今日速览 ─────────────────────────────────────── */}
          {/* `h-full` + `flex flex-col`（仅 `xl` 起）：让这一栏撑满左栏的高度，
              卡片组用 `flex-1` 吃掉剩余空间，日报卡再 `flex-1` —— 于是「今日
              日报」变成一块真正的**主卡**（而不是和另外两张一样高的小方块），
              整栏右缘与左栏的 CTA 行对齐。

              2026-10-17 第三次修正：`4xl`（≥1800）起右栏自己再拆两列。
              容器放到 1760 后，左栏封顶 544，右栏就吃掉 1073 —— 一张只有
              标题和两行摘要的卡片铺满 1073，右半边全是空气。现在 `4xl`
              下右栏变成 `[日报 1fr | 热点/分类 19rem]`：
              日报卡 759、右侧竖排两张 304，与左栏的 544 形成
              544 / 759 / 304 的三段节奏，hero 横向不再有一块空白。
              实现上用 `display:contents` 把卡片组「溶解」成右栏的 grid item，
              所以 DOM 结构不变、`xl`–`3xl` 的 flex 行为也不变。

              2026-10-27：`lg` 起可见（原来 `xl` 才可见，768–1279 右半屏全空）。
              但 `lg`–`xl` 之间只留「今日速览」标题行 + 今日日报主卡 ——
              两张小卡（此刻最热 / 按场景找）在 20rem 里会被挤成竖条，
              它们 `lg:hidden xl:grid`。 */}
          <div className="hidden min-w-0 md:flex md:flex-col xl:h-full 4xl:grid 4xl:grid-cols-[minmax(0,1fr)_19rem] 4xl:grid-rows-[auto_minmax(0,1fr)] 4xl:gap-2.5">
            <div className="mb-3 flex items-center justify-between 4xl:col-span-2 4xl:mb-0">
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-gongke-paper/55">
                今日速览
              </p>
              {daily && (
                <p className="flex items-center gap-1.5 text-2xs text-gongke-paper/55">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {formatDateFull(daily.date)} · {weekdayZh(daily.date)}
                </p>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2.5 4xl:contents">
              {daily && (
                <Link prefetch={false}
                  href={`/news/daily/${daily.date}`}
                  className={`${BRIEF_CARD} min-h-0 flex-1 4xl:col-start-1 4xl:row-start-2`}
                >
                  <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-gongke-onInk">
                    <Newspaper className="h-3 w-3" aria-hidden="true" />
                    今日日报 · 第 {issueNumber(dailyArchive, daily.date)} 期
                  </span>
                  <span className="mt-1.5 line-clamp-2 font-display text-lg leading-snug text-gongke-paper transition-colors group-hover:text-white">
                    {daily.lead?.title ?? '今日无大事发生'}
                  </span>
                  {daily.lead?.leadParagraph && (
                    <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-gongke-paper/60">
                      {daily.lead.leadParagraph}
                    </span>
                  )}
                  {/* ≥1800 时主卡被撑到 268px 高、字只占上面 68px，下三分之二
                      是空盒。补三条本期条目，它才配得上「主卡」的体量。
                      只在 `4xl` 开：`lg`–`xl` 之间右栏靠下面两张卡填满，
                      主卡保持自然高度更诚实。 */}
                  <span className="mt-2.5 hidden flex-col 4xl:flex">
                    {dailyPicks.map((it) => (
                      <span
                        key={it.title}
                        className="line-clamp-1 border-t border-white/10 pt-1.5 text-xs leading-snug text-gongke-paper/55 first:border-t-0 first:pt-0"
                      >
                        {it.title}
                      </span>
                    ))}
                  </span>
                  {/* 底栏：`mt-auto` 把它压到卡片下沿。`lg` 起就显示 ——
                      `lg`–`xl` 之间右栏只有这一张卡、并且 `h-full` 撑满左栏
                      高度，底部不填就会露出一块 150px 的空盒。这行同时是
                      主卡唯一指向「今天全部 N 条」的入口。 */}
                  <span className="mt-auto pt-2.5 text-2xs text-gongke-paper/55 transition-colors group-hover:text-gongke-paper/75">
                    查看今日全部 {dailyTotal} 条 →
                  </span>
                </Link>
              )}

              {/* 两张小卡：`xl` 起才出现。`lg`–`xl` 之间右栏只有 20rem，
                  两张卡并排各 130px，「月之暗面发布 Kimi K3.1 Pro，权重定于
                  11 月 4 日前释出」会被压成五行；这个区间只留今日日报主卡
                  —— 一张卡放得下，而且比两张挤成竖条的卡诚实。
                  `4xl` 起竖排到右栏第二列。 */}
              <div className="hidden shrink-0 grid-cols-2 gap-2.5 xl:grid 4xl:col-start-2 4xl:row-start-2 4xl:grid-cols-1 4xl:grid-rows-2">
                {hot && (
                  <Link prefetch={false} href="/news/hot" className={BRIEF_CARD}>
                    <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-gongke-onInk">
                      <Flame className="h-3 w-3" aria-hidden="true" />
                      此刻最热
                    </span>
                    <span className="mt-1.5 line-clamp-3 text-sm leading-snug text-gongke-paper/90">
                      {hot.title}
                    </span>
                    <span className="mt-auto pt-2.5 text-2xs text-gongke-paper/55">
                      {hot.sourceCount} 家来源在讨论
                    </span>
                  </Link>
                )}
                <Link prefetch={false} href="/categories" className={BRIEF_CARD}>
                  <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-gongke-onInk">
                    <Layers2 className="h-3 w-3" aria-hidden="true" />
                    按场景找
                  </span>
                  <span className="mt-1.5 line-clamp-3 text-sm leading-snug text-gongke-paper/90">
                    写作、编程、图像、视频、办公、研究……按你想做的事开始
                  </span>
                  <span className="mt-auto flex items-center gap-1 pt-2.5 text-2xs text-gongke-paper/55 transition-colors group-hover:text-gongke-paper/70">
                    {allCategories.length} 个分类
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── 底：体量数据带 ─────────────────────────────────────── */}
        {/* 2026-10-27：**整块从 hero 里删掉了**（`HeroStats` 已无调用点）。
            实测七个主流视口里只有 768×1024 与 1920×1080 能看到一张完整的
            工具卡：390×664 / 1024×768 / 1280×800 首卡可见高度是 **0**，
            1440×900 只露 44/139。hero 占掉 53–83% 的首屏，而它里面除了
            四行字就是这一排数字。

            而这排数字本身也是「hero 指标模板」—— 一个导航站不需要在首屏
            证明自己大，读者要的是「有没有我那个需求」。所以四个数字搬到
            「热门工具」标题行里当旁注（`InlineStats`，现在所有断点都显示），
            读者看到工具卡的同时看到体量，而不是先被体量挡住。
            见 `home-stats.tsx` 的说明。 */}
      </div>
    </section>
  );
}
