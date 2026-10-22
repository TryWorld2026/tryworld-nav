import Link from 'next/link';
import { ArrowUpRight, CalendarRange, ExternalLink, Layers, List, Timer } from 'lucide-react';
import { Reveal } from './reveal';
import { HeadlineText } from './headline-text';
import { PeriodPager } from './news-tabs';
import {
  formatDateFull,
  formatDateShort,
  formatMonth,
  formatPeriodRange,
  formatWeek,
  periodAnchor,
  periodStats,
} from '@/lib/news-period';
import { dayKey } from '@/lib/news';
import type { MonthlyReport, WeeklyReport } from '@/lib/news-period';

/**
 * 一期周报 / 月报的版面。
 *
 * 与日报的区别是**没有「今日看点」和「快讯」**：期报本身就是回顾，结构是
 * 导语（overview）→ 按重要度排的栏目 → 每栏开头一句小结（section.summary）。
 * 所以版面也收敛成一个单栏阅读流，不再有右栏日历 —— 期报的导航是「上一期 /
 * 下一期」，用底部的 `PeriodPager`。
 *
 * 周报与月报共用这个组件：两者数据形状一致（只有 `week` / `month` 键不同），
 * 差异只在标题与徽章文案，通过 `kind` 传入。
 */
export function NewsPeriodPage({
  report,
  kind,
  prev,
  next,
}: {
  report: WeeklyReport | MonthlyReport;
  kind: 'weekly' | 'monthly';
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
}) {
  const stats = periodStats(report);
  const key = kind === 'weekly' ? (report as WeeklyReport).week : (report as MonthlyReport).month;
  const title = kind === 'weekly' ? formatWeek(key) : formatMonth(key);
  const subLabel = kind === 'weekly' ? '每周回顾' : '每月回顾';
  const periodText = formatPeriodRange(report.periodStart, report.periodEnd);

  return (
    <div
      id="top"
      className="period-container pb-16 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_13rem] 2xl:items-start 2xl:gap-12"
    >
      <article className="min-w-0">
        {/* 报头 */}
        <header className="border-b border-foreground/10 pb-7">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
            AIHOT · {subLabel}
          </p>
          <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
            AI {kind === 'weekly' ? '周报' : '月报'} · {title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {periodText && <span>{periodText}</span>}
            <span>共 {stats.items} 条</span>
            <span>{stats.sources} 个来源</span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3 w-3" aria-hidden="true" />约 {stats.minutes} 分钟
            </span>
          </div>

          {report.overview && (
            // 不再限 `max-w-[66ch]`：本页的容器（`.period-container` 860 /
            // ≥1536 时 1088 扣掉目录列后 768）本身就把行长收在 51–53 个
            // 汉字，正好是中文正文的舒适上限。再套一层 ch 限宽只会让导语
            // 比它下面的栏目标题、条目短掉 1/3，右缘参差。
            <p className="mt-5 border-l-2 border-gongke-accent/30 pl-4 text-[15px] leading-relaxed text-foreground/70">
              {report.overview}
            </p>
          )}
        </header>

        {/* 头条 */}
        {report.headline && (
          <Reveal as="section" className="mt-7">
            <div className="rounded-2xl border border-foreground/10 bg-card p-5 md:p-6">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gongke-accent">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                本期头条
              </p>
              <h2 className="text-balance font-display text-[22px] leading-snug text-foreground md:text-2xl">
                <HeadlineText text={report.headline} />
              </h2>
            </div>
          </Reveal>
        )}

        {/* 栏目 */}
        <div className="mt-10 space-y-11">
          {report.sections.map((s, si) => (
            <Reveal
              as="section"
              key={s.label}
              id={periodAnchor(si)}
              className="scroll-mt-32"
              delay={Math.min(si, 4)}
            >
              <div className="mb-4 flex items-baseline gap-3 border-b border-foreground/10 pb-2.5">
                <span className="font-display text-2xl leading-none text-gongke-accent tabular-nums">
                  {String(si + 1).padStart(2, '0')}
                </span>
                <h2 className="text-lg font-bold text-foreground">{s.label}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{s.items.length} 件</span>
              </div>
              {s.summary && (
                // 底纹铺满整栏、文字也铺满：原来 `max-w-[68ch]` 和
                // `bg-foreground/[0.03]` 写在同一个 `<p>` 上，1440 下这块
                // 浅底只有 528px 宽，右侧留 332px 空白，读起来像「这条
                // 小结没排完」。改整行底色后又留着 68ch，浅底里右缘仍然
                // 空出 240px —— 同一处毛病换了个位置。栏宽本身就是行长。
                <div className="mb-4 rounded-lg bg-foreground/[0.03] px-3.5 py-2.5">
                  {/* 14px 正文的对比度得守住 AA：/60 在纸上只有 4.06:1，
                      /65 是 4.68:1。灰底不影响这条基线（底色只差 3%）。 */}
                  <p className="text-balance text-sm leading-relaxed text-foreground/65">
                    {s.summary}
                  </p>
                </div>
              )}
              <ol className="space-y-5">
                {s.items.map((it, ii) => (
                  <li key={it.links.original ?? it.links.aihot ?? it.title}>
                    <a
                      href={it.links.original ?? it.links.aihot ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg"
                      id={`${periodAnchor(si)}-${ii}`}
                    >
                      <p className="text-[11px] font-medium text-foreground/70">{it.source}</p>
                      {/* `text-balance`：标题在 390 的窄卡里折成两行，末行常
                          只剩一两个字（实测 4 条里 3 条 <15%）。 */}
                      <h3 className="mt-0.5 text-balance text-[16px] font-semibold leading-snug text-foreground/90 transition-colors group-hover:text-gongke-accent md:text-[17px]">
                        <HeadlineText text={it.title} />
                        <ArrowUpRight
                          className="ml-1 inline h-3.5 w-3.5 -translate-y-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60"
                          aria-hidden="true"
                        />
                      </h3>
                      {/* 同上：摘要与上面的标题同宽，右缘对齐成一列。 */}
                      {it.summary && (
                        <p className="mt-1 text-balance text-sm leading-relaxed text-foreground/70">
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

        <PeriodPager label={kind === 'weekly' ? '切换周报' : '切换月报'} prev={prev} next={next} />

        <p className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 text-xs leading-relaxed text-muted-foreground">
          {kind === 'weekly' ? '周报' : '月报'}由 AIHOT 根据当期日报汇总整理，每条保留原文链接。
          <a
            href={
              kind === 'weekly'
                ? 'https://aihot.news/weekly'
                : 'https://aihot.news/monthly'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mx-1 underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
          >
            查看 AIHOT 原刊
          </a>
          {report.generatedAt && (
            <span className="ml-1 inline-flex items-center gap-1">
              {/* `dayKey` 把 ISO 瞬间折成**北京日历日**；原来的
                  `generatedAt.slice(0, 10)` 取的是 **UTC 日**，在北京时间
                  00:00–08:00 生成的报告会显示成前一天。
                  线上现成实例：`/news/monthly/2026-08` 实际生成于
                  2026-09-11 04:56（北京），页面却写「2026 年 9 月 10 日」。 */}
              · 生成于 {formatDateFull(dayKey(report.generatedAt))}
            </span>
          )}
        </p>

        {/* 期次导航 */}
        <nav aria-label="其他期次" className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">其他期次</span>
            <Link prefetch={false}
              href={kind === 'weekly' ? '/news/weekly' : '/news/monthly'}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:border-gongke-accent/30 hover:text-gongke-accent"
            >
              全部{kind === 'weekly' ? '周报' : '月报'}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
            <Link prefetch={false}
              href="/news/daily"
              className="inline-flex items-center gap-1 rounded-full border border-foreground/10 px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:border-gongke-accent/30 hover:text-gongke-accent"
            >
              回到日报
            </Link>
          </div>
        </nav>

        <p className="mt-10 text-center text-xs tracking-[0.3em] text-muted-foreground">
          （本期完）
        </p>
      </article>

      {/* 栏目目录（仅 2xl 及更宽）。
          期报正文最宽 860，在 1536 以上两侧各空出近 300px，单栏读起来像
          「一张纸掉在了大桌子上」。这里把右边那条空白变成目录：栏目数通常
          5–8 个，正好一屏放下，读者在长列表里随时能跳。
          断点跟着 `.period-container` 的放宽走（globals.css 里 1536 起
          860 → 1088），两者必须同时生效 —— 容器不先变宽，目录没有位置。 */}
      <aside className="hidden 2xl:col-start-2 2xl:row-start-1 2xl:block" aria-label="本期目录">
        <div
          className="sticky"
          style={{ top: 'calc(var(--site-header-h, 3.5rem) + 1.5rem)' }}
        >
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <List className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
            本期目录
          </p>
          <ol className="border-l border-foreground/10">
            {report.sections.map((s, si) => (
              <li key={s.label}>
                <a
                  href={`#${periodAnchor(si)}`}
                  className="-ml-px flex items-baseline gap-2 border-l-2 border-transparent py-1.5 pl-3 pr-1 text-[13px] text-foreground/65 transition-colors hover:border-gongke-accent/50 hover:text-foreground"
                >
                  <span className="shrink-0 text-[11px] tabular-nums text-gongke-accent">
                    {String(si + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {s.items.length}
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <a
            href="#top"
            className="mt-4 inline-flex items-center gap-1 pl-3 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            回到顶部
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </aside>
    </div>
  );
}
