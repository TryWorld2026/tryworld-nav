import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Flag,
  Hash,
  Quote,
  Timer,
} from 'lucide-react';
import { Reveal } from './reveal';
import { HeadlineText } from './headline-text';
import { PeriodPager } from './news-tabs';
import { DailyArchive, DailyMiniCalendar } from './news-daily-archive';
import {
  beijingTime,
  dailyNeighbors,
  dailyPager,
  dailyStats,
  formatDateFull,
  formatDateShort,
  formatMonth,
  highlights,
  leadLinks,
  leadSource,
  monthCalendar,
  numberedSections,
  parseDateKey,
  issueNumber,
  weekdayZh,
} from '@/lib/news-period';
import type { DailyArchiveEntry, DailyReport } from '@/lib/news-period';

/**
 * 一期 AI 日报的版面。
 *
 * 结构对齐 https://aihot.news/daily ：报头（日期/期号/统计）→ 头条 → 今日看点
 * → 本期版面（目录）→ 01–05 正文栏目 → 快讯 → 前一期 → 出处。
 * 这是**服务端组件**（没有 'use client'），整页预渲染成 HTML；唯一需要客户端
 * 的地方是 `Reveal` 的入场观察器与 `PeriodPager` 的链接（无需 JS）。
 *
 * 三栏（桌面）：左栏往期归档（sticky）、中间正文、右栏日历与阅读提示。
 * 手机上归档收进正文之后的折叠块，日历不显示 —— 手机屏幕优先给正文。
 *
 * 排版原则：
 *   - 头条用最大字号 + 衬线导语（`.prose-lead` 由 globals.css 提供），
 *     与正文栏目的 18px 标题拉开层级；
 *   - 栏目头是一条「序号 + 中文名 + 条数」的横线，序号用品牌绿，替代 AIHOT
 *     的大号数字徽章（本站在骨白底上不堆装饰块）；
 *   - 快讯是紧凑的带点列表，不再重复卡片形态，节奏上形成「长—短」对比。
 */

const ACCENT = 'text-gongke-accent';

export function NewsDailyPage({
  report,
  archive,
  latestDate,
}: {
  report: DailyReport;
  archive: DailyArchiveEntry[];
  latestDate: string;
}) {
  const stats = dailyStats(report);
  const sections = numberedSections(report);
  const hls = highlights(report, 3);
  const lead = report.lead;
  /**
   * 头条兜底。AIHOT 的接口对**早期期次**不返回 `lead`（或返回空串的
   * `leadParagraph`），这些页原来会整块不渲染「头条」—— 打开一期 4 月的日报，
   * 报头下面直接是「今日看点」，版面上最重的位置空着，读者以为页面缺了一块。
   *
   * 兜底顺序刻意保持「都是真数据」：
   *   标题  lead.title → 归档里的 leadTitle → 第一个栏目的第一条
   *   导语  lead.leadParagraph → 同一条的 summary（空串也算没有，所以用 `||`）
   * 链接与来源跟着同一条走，匹配不到就不给「原文」按钮，不猜链接。
   */
  const archiveEntry = archive.find((e) => e.date === report.date);
  const firstItem = sections[0]?.items[0];
  const leadTitle = lead?.title || archiveEntry?.leadTitle || firstItem?.title || '';
  const leadDek =
    lead?.leadParagraph || firstItem?.summary || archiveEntry?.leadParagraph || '';
  const leadLink = lead ? leadLinks(report) : (firstItem?.links ?? null);
  const leadSrc = lead ? leadSource(report) : (firstItem?.source ?? null);
  const { prev, next } = dailyNeighbors(archive, report.date);
  const cal = monthCalendar(report.date, archive);
  const monthCount = archive.filter((e) => e.date.startsWith(report.date.slice(0, 7))).length;
  const pager = dailyPager(archive, report.date, latestDate);
  const issue = issueNumber(archive, report.date);
  const day = parseDateKey(report.date);

  // `.rail-container`：带导航的阅读页，左归档 216 + 中正文 + 右日历 248。
  // 中栏必须封顶 —— 正文行长舒适区间在 48 个汉字左右，与
  // `tool-details.tsx` 的 48rem 同口径。注意不能用 `xl:max-w-[…]` 从外面
  // 收 —— 那是个 utility，会被 `globals.css` 里不加 `@layer` 的容器规则
  // 冲掉，只能像下面这样在栅格轨道上收。
  //
  // 2026-10-18：外框与全站同宽了（`.rail-container` 改走 content 阶梯，
  // ≥1800 时 1600/1760）。所以在 ≥1800 把中栏轨道固定成 48rem、两侧列宽
  // 不变，多出来的宽度全部分给两道栏距（`justify-between`）：中栏的字号、
  // 行长、图片宽度与 1440 下逐像素一致，只是两侧的留白更宽 —— 而不是让
  // 正文跟着视口长到一行 70 个汉字。
  //
  // 右栏的断点用 `min-[1440px]` 而不是 `xl`（1280）：1280 下可用宽度只有
  // 1216，左右两栏吃掉 544（216 + 248 + 80 间距），中栏剩 672 —— 正文还行，
  // 但三栏的「栏」都太窄，归档里的标题和日历格开始截断。1440 下中栏 768，
  // 才是上面那句「中栏落在 768 左右」真正成立的地方；1280–1439 用两栏，
  // 日历让位给正文。
  return (
    <div className="rail-container pb-16 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10 min-[1440px]:grid-cols-[13.5rem_minmax(0,1fr)_15.5rem] min-[1800px]:grid-cols-[13.5rem_minmax(0,48rem)_15.5rem] min-[1800px]:justify-between">
      {/* ── 左栏：往期归档（桌面） ───────────────────────────────── */}
      <DailyArchive archive={archive} current={report.date} />

      {/* 注：归档列 179 期 × 每期标题，在每张日报页上都会完整出现一次。这是
          有意的 —— 它让「翻往期」在任何一期上都是一次点击，代价是每页约
          270 KB 的静态 HTML（gzip 后约 30 KB）。如果日后觉得太重，先改成
          「只看最近 30 期 + 全部归档链接」，而不是把这个导航删掉。 */}

      {/* ── 中栏：正文 ─────────────────────────────────────────── */}
      <article className="min-w-0">
        {/* 报头 ---------------------------------------------------- */}
        <header className="border-b border-foreground/10 pb-6">
          {/* 日期分页：今天 / 昨天 / … / 更早。与 AIHOT 的顶部日期条同形。 */}
          <nav
            aria-label="切换日报日期"
            className="scrollbar-none -mx-1 mb-5 flex items-center gap-1.5 overflow-x-auto px-1"
          >
            {pager.map((p) => (
              <Link prefetch={false}
                key={p.label + (p.date ?? 'archive')}
                // `date: null` 是「更早」且已经翻到归档末尾，去总归档页。
                href={p.date ? `/news/daily/${p.date}` : '/news/daily/archive'}
                aria-current={p.current ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                  p.current
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {p.label}
              </Link>
            ))}
            {/* 手机上隐藏：日期条本身是可横滑的，「全部往期 →」贴在它右端时
                会把最后几个日期 chip 顶出可视区（390 视口实测溢出 23.5px，
                箭头被裁一半，也没有任何「还能滑」的提示）。面包屑里已经
                有同一个入口，这里只在 sm 起显示。
                高度同样从 py-1（24px）提到 py-1.5（32px）—— 和左边日期 chip
                对齐，点起来也不再是一条缝。 */}
            <Link prefetch={false}
              href="/news/daily/archive"
              className="ml-auto hidden shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
            >
              全部往期 →
            </Link>
          </nav>

          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            人工智能 · 每日要闻
          </p>

          <h1 className="font-display text-[26px] leading-tight text-foreground sm:text-3xl md:text-[34px]">
            AI 日报 · {formatDateFull(report.date)}
            {/* 星期只在 sm 起跟着标题。390 下「AI 日报 · 2026 年 10 月 17 日」
                已经占满一整行，「周六」必然被挤到第二行、单独占一行两字，
                看起来像排坏了而不是排成了两行；手机上它并进下面的日期元信息。 */}
            <span className="ml-2 hidden whitespace-nowrap text-base font-normal text-muted-foreground sm:inline sm:text-lg">
              {weekdayZh(report.date)}
            </span>
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground/70">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-gongke-accent"
                aria-hidden="true"
              />
              AIHOT · AIHOT.NEWS
            </span>
            {issue > 0 && (
              <span className="inline-flex items-center gap-1">
                <Hash className="h-3 w-3" aria-hidden="true" />第 {issue} 期
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {formatMonth(report.date.slice(0, 7))}
              {/* `report.date` 是北京日历日键，直接切月份是安全的。 */}
              <span className="sm:hidden">· {weekdayZh(report.date)}</span>
            </span>
            <span>每天 08:00 出刊</span>
          </div>

          {/* 统计条。四个数字，粗体数字 + 灰色单位。 */}
          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: '件大事', value: stats.items },
              { label: '个来源', value: stats.sources },
              { label: '个栏目', value: stats.sections },
              { label: '分钟读完', value: stats.minutes, prefix: '约 ' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-foreground/10 bg-card px-3 py-2.5"
              >
                {/* 数字在上、量词在下。原来是「件大事 / 22」——中文读起来是
                    倒的（要读成「22 件大事」），而索引页的大卡早就是数字在上。
                    两处口径现在一致。 */}
                <dd className="text-xl font-bold tabular-nums text-foreground">
                  {s.prefix}
                  {s.value}
                </dd>
                <dt className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </header>

        {/* 头条 ---------------------------------------------------- */}
        {leadTitle && (
          <Reveal as="section" className="mt-8">
            <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-card p-5 md:p-7">
              {/* 左侧品牌色竖条：给头条一个不用图片的视觉锚点。 */}
              <span
                className="absolute inset-y-5 left-0 w-[3px] rounded-r bg-gongke-accent"
                aria-hidden="true"
              />
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gongke-accent">
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                头条
              </p>
              <h2 className="text-balance font-display text-[22px] leading-snug text-foreground md:text-[28px]">
                {leadLink ? (
                  <a
                    href={leadLink.original}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-start gap-2 transition-colors hover:text-gongke-accent"
                  >
                    {/* 包一层 `<span>`：`<a>` 是 `inline-flex` + `gap-2`，
                        `HeadlineText` 会拆出多个 `<span>`，直接放进来会变成
                        多个 flex 子项，中英文之间被撑出 8px 的空档。 */}
                    <span className="min-w-0">
                      <HeadlineText text={leadTitle} />
                    </span>
                    <ArrowUpRight
                      className="mt-1.5 h-4 w-4 shrink-0 opacity-40 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <HeadlineText text={leadTitle} />
                )}
              </h2>
              {/* 不限 `ch`：中栏本身就是行长。≥1800 时这一栏被钉在 48rem
                  （768px），15px 下正好约 51 个汉字，已经在舒适上限内；
                  再套 62ch（约 516px）只会让导语比上面的标题短掉 1/3，
                  右侧平白空出 250px。 */}
              {/* `text-balance`：1024 下中栏 623px，导语折成三行，末行只剩
                  十来个字（实测 12%）。这是全页的字眼，值得排匀。 */}
              <p className="mt-3 text-balance text-[15px] leading-relaxed text-foreground/70">
                {leadDek}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {leadSrc && <span>来源：{leadSrc}</span>}
                {leadLink?.original && (
                  <a
                    href={leadLink.original}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-2.5 py-1 font-medium text-foreground/70 transition-colors hover:border-gongke-accent/30 hover:text-gongke-accent"
                  >
                    原文 <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
                {leadLink?.aihot && (
                  <a
                    href={leadLink.aihot}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    AIHOT 条目
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        )}

        {/* 今日看点 ------------------------------------------------ */}
        {hls.length > 0 && (
          <Reveal as="section" className="mt-6" delay={1}>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 md:p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                今日看点
                <span className="ml-2 font-normal normal-case tracking-normal">
                  各栏目头条
                </span>
              </h2>
              <ol className="space-y-1.5">
                {hls.map((h, i) => (
                  <li key={h.title}>
                    <a
                      href={`#${h.anchor}`}
                      className="group flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-foreground/[0.03]"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gongke-accent/10 text-[11px] font-bold text-gongke-accent tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        {/* `text-balance`：列表项标题在 1024 的窄栏里折两行，
                            末行只剩几个字（实测 8%、11%）。 */}
                        <span className="block text-balance text-[15px] leading-snug text-foreground/85 transition-colors group-hover:text-gongke-accent">
                          {h.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {h.sectionLabel} · {h.source}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        )}

        {/* 本期版面 ------------------------------------------------ */}
        {sections.length > 0 && (
          <Reveal as="section" className="mt-6" delay={2}>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              本期版面
            </h2>
            {/* 版面数每期都在变（实测 2–6 个栏目，五列只是其中一种）。
                固定 `grid-cols-5` 时四栏期刊右侧空 130–155px，而 1280 以下
                每列 112px、内宽只有 90px，「产品更新」这类四字标签开始截断。
                改成 flex-wrap + `flex-1`：每行自动铺满、末行剩下的格子由卡片
                拉伸吃掉，2 栏到 6 栏都不会留洞，也不用为每个断点补特例。 */}
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <a
                  key={s.anchor}
                  href={`#${s.anchor}`}
                  className="group min-w-[7rem] flex-1 rounded-xl border border-foreground/10 bg-card px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/30 hover:shadow-sm active:translate-y-0"
                >
                  <span className="block text-[11px] font-semibold tracking-wider text-gongke-accent tabular-nums">
                    {s.index}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-foreground/80 transition-colors group-hover:text-foreground">
                    {s.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{s.count} 件</span>
                </a>
              ))}
            </div>
          </Reveal>
        )}

        {/* 正文栏目 ------------------------------------------------ */}
        <div className="mt-10 space-y-12">
          {sections.map((s, si) => (
            <Reveal as="section" key={s.anchor} delay={Math.min(si, 4)}>
              <div id={s.anchor} className="scroll-mt-32" />
              <div className="mb-5 flex items-baseline gap-3 border-b border-foreground/10 pb-2.5">
                <span className="font-display text-2xl leading-none text-gongke-accent tabular-nums">
                  {s.index}
                </span>
                <h2 className="text-lg font-bold text-foreground">{s.label}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{s.count} 件</span>
              </div>
              <ol className="space-y-6">
                {s.items.map((it) => (
                  <li key={it.links.original ?? it.links.aihot ?? it.title} className="group">
                    <a
                      href={it.links.original ?? it.links.aihot ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg transition-colors"
                    >
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        {/* 11px 的来源行按 AA 要 5:1，/60 只有 4.06:1；
                            /75 落在 6.4:1，仍是弱化的次级信息。 */}
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/75">
                          <span
                            className="h-1 w-1 rounded-full bg-gongke-accent/70"
                            aria-hidden="true"
                          />
                          {it.source}
                        </span>
                      </p>
                      <h3 className="mt-1 text-balance text-[17px] font-semibold leading-snug text-foreground/90 transition-colors group-hover:text-gongke-accent md:text-lg">
                        <HeadlineText text={it.title} />
                        <ArrowUpRight
                          className="ml-1 inline h-3.5 w-3.5 -translate-y-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60"
                          aria-hidden="true"
                        />
                      </h3>
                      {/* 同导语：摘要与标题同宽，右缘对齐。 */}
                      {it.summary && (
                        <p className="mt-1.5 text-balance text-sm leading-relaxed text-foreground/65">
                          {it.summary}
                        </p>
                      )}
                    </a>
                  </li>
                ))}
              </ol>
            </Reveal>
          ))}
        </div>

        {/* 快讯 ---------------------------------------------------- */}
        {report.flashes.length > 0 && (
          <Reveal as="section" className="mt-12" delay={2}>
            <div className="mb-4 flex items-baseline gap-3 border-b border-foreground/10 pb-2.5">
              <span className="font-display text-2xl leading-none text-gongke-accent tabular-nums">
                {String(sections.length + 1).padStart(2, '0')}
              </span>
              <h2 className="text-lg font-bold text-foreground">快讯</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {report.flashes.length} 条
              </span>
            </div>
            <ul className="space-y-0.5">
              {report.flashes.map((f) => (
                <li key={f.links.original ?? f.title}>
                  <a
                    href={f.links.original ?? f.links.aihot ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <span
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/25 transition-colors group-hover:bg-gongke-accent"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/75 transition-colors group-hover:text-foreground">
                      {f.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {f.source}
                      {beijingTime(f.publishedAt) && (
                        <span className="ml-1.5 tabular-nums">{beijingTime(f.publishedAt)}</span>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {/* 本期完 + 翻页 ------------------------------------------- */}
        <p className="mt-12 text-center text-xs tracking-[0.3em] text-muted-foreground">
          （本期完）
        </p>

        <PeriodPager
          label="切换日报"
          prev={
            prev
              ? { href: `/news/daily/${prev.date}`, label: `${formatDateShort(prev.date)} · ${prev.leadTitle ?? '日报'}` }
              : null
          }
          next={
            next
              ? { href: `/news/daily/${next.date}`, label: `${formatDateShort(next.date)} · ${next.leadTitle ?? '日报'}` }
              : null
          }
        />

        {/* 出处 ---------------------------------------------------- */}
        {/* 署名框是 12px 的整段白话，1280 起折成两行、末行只剩三五个字；
            `text-balance` 让两行接近等长，读起来不像被硬切断。 */}
        <p className="mt-8 text-balance rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
          AIHOT 日报根据公开报道自动整理，每条都附原文。
          <a
            href="https://aihot.news/daily"
            target="_blank"
            rel="noopener noreferrer"
            className="mx-1 underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
          >
            AIHOT
          </a>
          出品，本站仅作聚合展示，版权归各来源与原作者所有。今日共 {stats.items} 条、来自{' '}
          {stats.sources} 个来源。
        </p>

        {/* 手机端归档 ---------------------------------------------- */}
        <DailyArchive archive={archive} current={report.date} variant="inline" />
      </article>

      {/* ── 右栏：日历与阅读提示（桌面） ─────────────────────────── */}
      <aside className="hidden min-[1440px]:block" aria-label="日报信息">
        <div className="sticky top-32 space-y-4">
          {cal && (
            <DailyMiniCalendar calendar={cal} current={report.date} monthCount={monthCount} />
          )}

          <div className="rounded-xl border border-foreground/10 bg-card p-3.5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Timer className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
              阅读提示
            </h3>
            {/* 右栏只有 218px，三条提示都折成两行、末行只剩四五个字。均衡
                换行把它们拉成两条等长的句子，右栏的三块文字才有齐整的右缘。 */}
            <ul className="space-y-1.5 text-balance text-xs leading-relaxed text-muted-foreground">
              <li>点标题直接打开原文，来源站名在标题上方。</li>
              <li>「今日看点」按各栏目头条自动取三，点击可跳到对应栏目。</li>
              <li>期号按归档顺序计算，第 1 期是 4 月 22 日。</li>
            </ul>
          </div>

          <div className="rounded-xl border border-foreground/10 bg-card p-3.5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <BookOpen className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
              换个读法
            </h3>
            <div className="space-y-1">
              {[
                { href: '/news', label: '资讯流 · 最新 7 天' },
                { href: '/news/weekly', label: '周报 · 一周回顾' },
                { href: '/news/monthly', label: '月报 · 一月回顾' },
                { href: '/news/hot', label: '热点榜 · 此刻最热' },
              ].map((l) => (
                <Link prefetch={false}
                  key={l.href}
                  href={l.href}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  {l.label}
                  <ArrowUpRight className="h-3 w-3 opacity-40" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          {leadTitle && (
            <blockquote className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3.5">
              <Quote className="mb-1 h-3.5 w-3.5 text-gongke-accent/60" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-foreground/65">
                今日头条：{leadTitle}
              </p>
            </blockquote>
          )}
        </div>
      </aside>
    </div>
  );
}
