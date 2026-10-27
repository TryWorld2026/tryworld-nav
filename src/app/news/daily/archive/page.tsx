import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, ChevronLeft } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { Reveal } from '@/components/reveal';
import { dailyArchive } from '@/lib/daily-data';
import { archiveGroups, formatDateShort, weekdayZh } from '@/lib/news-period';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical('/news/daily/archive'),
  title: 'AI 日报 · 全部往期',
  description: 'AIHOT 每日要闻的完整归档，按月份列出全部 AI 日报，点开任意一期即可在站内阅读。',
  },
  '/news/daily/archive',
);

/**
 * 日报归档总览。`/news/daily` 只展开最近两个月，这个页面把 179 期一次铺完，
 * 适合「我想从 4 月翻起」的读者。分组与折叠逻辑复用 `/news/daily` 的同一套
 * 纯函数（`archiveGroups`），所以两处不会出现月份归类不一致。
 */
export default function DailyArchivePage() {
  const groups = archiveGroups(dailyArchive);

  return (
    <div className="pb-16">
      {/* `width="content"` 跟着下面这本 1760 的三列月份矩阵走：默认的
          `reading`（1088）在 2560 下比它右移 328px，是频道里错位最大的一页。 */}
      <NewsTabs active="daily" width="content" />

      <div className="content-container">
        <Link prefetch={false}
          href="/news/daily"
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          返回最新一期
        </Link>

        <header className="border-b border-foreground/10 pb-6">
          <h1 className="font-display text-3xl text-foreground">AI 日报 · 全部往期</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gongke-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              共 {dailyArchive.length} 期
            </span>
            {dailyArchive.length > 0 && (
              <span>
                {formatDateShort(dailyArchive[dailyArchive.length - 1].date)} —{' '}
                {formatDateShort(dailyArchive[0].date)}
              </span>
            )}
            <span className="text-xs">每天 08:00 出刊</span>
          </p>
        </header>

        {/* 显式 `grid-cols-1`（= `minmax(0,1fr)`）：不写时列宽是 `auto`，
            会被里层日期标题的最小内容宽度撑到 805px，手机整页横滑。 */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g, gi) => (
            <Reveal key={g.key} delay={Math.min(gi, 6)} as="section">
              <div className="rounded-xl border border-foreground/10 bg-card p-4">
                <h2 className="mb-2.5 flex items-baseline justify-between border-b border-foreground/5 pb-2 text-sm font-semibold text-foreground">
                  {g.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {g.days.length} 期
                  </span>
                </h2>
                <ul className="space-y-0.5">
                  {g.days.map((d) => (
                    <li key={d.date}>
                      <Link prefetch={false}
                        href={`/news/daily/${d.date}`}
                        className="group flex items-baseline gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-foreground/5"
                      >
                        <span className="w-[4.5rem] shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatDateShort(d.date)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground/70 transition-colors group-hover:text-foreground">
                          {d.leadTitle ?? '（无头条）'}
                        </span>
                        {/* 10px × 70% 的灰字在骨白底上几乎看不见（对比度约
                            2.6:1）；星期是这条目里唯一能区分「哪天」的线索，
                            至少要到 11px + 正常 muted。 */}
                        <span className="hidden shrink-0 text-2xs text-muted-foreground sm:inline">
                          {weekdayZh(d.date)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          归档来自 AIHOT 公开接口，按北京时间切分日期。
        </p>
      </div>
    </div>
  );
}
