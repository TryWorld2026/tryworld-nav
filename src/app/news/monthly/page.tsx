import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { MastheadMeta, NewsMasthead } from '@/components/news-masthead';
import { IssueContents, IssueCoverlines } from '@/components/issue-contents';
import { HeadlineText } from '@/components/headline-text';
import { Reveal } from '@/components/reveal';
import { monthlyReports } from '@/lib/daily-data';
import { formatMonth, formatPeriodRange, periodStats } from '@/lib/news-period';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical('/news/monthly'),
  title: 'AI 月报',
  description:
    'AIHOT 每月回顾：一个月的模型与产品发布、行业变化、论文与观点，按重要度排序，每条附原文。',
  },
  '/news/monthly',
);

/**
 * 月报索引。数量少（目前 5 期），最新一期做成墨色大卡，其余月份铺成一排。
 *
 * 2026-10-18：版心从 1088 改到 1760，与频道其余分区一致；版式也从「五张
 * 同等重量的双列卡片」改为「一张头条 + 一排月度」。五张同构卡片在阅读宽度
 * 下排成两列时，最后一张永远孤零零地挂在第三行左侧 —— 一个只有五条的
 * 栏目看起来像没排完。给最新一期头条的位置之后，层级和数量都对上了。
 */
export default function MonthlyIndexPage() {
  const [latest, ...rest] = monthlyReports;
  const latestStats = latest ? periodStats(latest) : null;

  return (
    <div className="pb-16">
      <NewsTabs active="monthly" width="content" />

      <NewsMasthead
        width="content"
        eyebrow="AIHOT · 每月回顾"
        title="AI 月报"
        description="以月为尺度看 AI：哪些能力真的往前挪了一格，哪些发布只是当周热闹。月报把当月的日报汇总成一份可回看的账本。"
        icon={<CalendarDays className="h-3.5 w-3.5" />}
      >
        <MastheadMeta>
          <span>
            已收录 <strong className="font-semibold text-[#F2EEE6]">{monthlyReports.length}</strong> 期
          </span>
          {latest && <span>最新：{formatMonth(latest.month)}</span>}
        </MastheadMeta>
      </NewsMasthead>

      <div className="content-container">
        {!latest ? (
          <p className="py-20 text-center text-sm text-muted-foreground">暂时没有月报数据。</p>
        ) : (
          <>
            <Reveal as="section" className="mt-8">
              <Link prefetch={false}
                href={`/news/monthly/${latest.month}`}
                className="ink-band group relative block overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#1B2523]/25 active:translate-y-0 md:p-8"
              >
                {/* 与周报同一张封面：左边讲什么，右边书脊竖排「分几栏 +
                    多少量」（见 `IssueContents` 的注释）。 */}
                <div className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10 2xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:gap-14">
                  <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[#F2EEE6] px-2.5 py-1 font-semibold text-[#1B2523]">
                      最新一期
                    </span>
                    <span className="font-display text-sm text-[#F2EEE6]/80">
                      {formatMonth(latest.month)}
                    </span>
                    <span className="text-[#F2EEE6]/55">
                      {formatPeriodRange(latest.periodStart, latest.periodEnd)}
                    </span>
                  </div>
                  <h2 className="max-w-[40ch] text-balance font-display text-2xl leading-[1.22] text-[#F2EEE6] transition-colors group-hover:text-white md:text-[30px] 2xl:text-[42px]">
                    {latest.headline ? <HeadlineText text={latest.headline} /> : '本月回顾'}
                  </h2>
                  {latest.overview && (
                    <p className="mt-3 line-clamp-3 max-w-[58ch] text-sm leading-relaxed text-[#F2EEE6]/60 md:text-[15px] 2xl:max-w-[44rem] 2xl:text-[16px]">
                      {latest.overview}
                    </p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#F2A07F]">
                    阅读本期
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                  <IssueCoverlines
                      items={latest.sections.flatMap((s) => s.items).filter((it) => it.title !== latest.headline)}
                    />
                  </div>

                  <div className="mt-7 min-w-0 border-t border-white/15 pt-5 lg:mt-0 lg:border-t-0 lg:border-l lg:pl-9 lg:pt-0 2xl:pl-12">
                    <IssueContents sections={latest.sections} />
                    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/15 pt-5 sm:grid-cols-4 lg:grid-cols-2">
                      {latestStats &&
                        [
                          ['条要闻', latestStats.items],
                          ['个来源', latestStats.sources],
                          ['个栏目', latestStats.sections],
                          ['分钟读完', latestStats.minutes],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="min-w-0">
                            <dd className="font-display text-[24px] leading-none tabular-nums text-[#F2EEE6]">
                              {value}
                            </dd>
                            <dt className="mt-1.5 text-[11px] tracking-wide text-[#F2EEE6]/55">
                              {label}
                            </dt>
                          </div>
                        ))}
                    </dl>
                  </div>
                </div>
              </Link>
            </Reveal>

            {rest.length > 0 && (
              <section className="mt-10">
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  {/* 与日报「全部往期」同一档：页底横带标题 19px 半粗。 */}
                  <h2 className="text-[19px] font-semibold text-foreground">往期月报</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    共 {rest.length} 期
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {rest.map((m, i) => {
                    const stats = periodStats(m);
                    return (
                      <Reveal key={m.month} delay={Math.min(i, 6)} as="section" className="min-w-0">
                        <Link prefetch={false}
                          href={`/news/monthly/${m.month}`}
                          className="group flex h-full flex-col rounded-xl border border-foreground/10 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/30 hover:shadow-md active:translate-y-0"
                        >
                          <span className="font-display text-xl leading-none text-foreground">
                            {formatMonth(m.month)}
                          </span>
                          <span className="mt-2 line-clamp-3 flex-1 text-[13.5px] leading-snug text-foreground/75 transition-colors group-hover:text-foreground">
                            {m.headline ?? '本月回顾'}
                          </span>
                          <span className="mt-3 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                            <span>
                              {stats.items} 条 · {stats.sections} 栏
                            </span>
                            <ArrowRight
                              className="h-3.5 w-3.5 text-gongke-accent transition-transform duration-200 group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </span>
                        </Link>
                      </Reveal>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <p className="mt-10 border-t border-foreground/10 pt-5 text-xs text-muted-foreground">
          月报由{' '}
          <a
            href="https://aihot.news/monthly"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
          >
            AIHOT
          </a>{' '}
          汇总当月日报生成，本站仅作聚合展示。
        </p>
      </div>
    </div>
  );
}
