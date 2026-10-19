import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarRange } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { MastheadMeta, NewsMasthead } from '@/components/news-masthead';
import { IssueContents, IssueCoverlines } from '@/components/issue-contents';
import { HeadlineText } from '@/components/headline-text';
import { Reveal } from '@/components/reveal';
import { weeklyReports } from '@/lib/daily-data';
import { formatPeriodRange, formatWeek, periodStats } from '@/lib/news-period';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical('/news/weekly'),
  title: 'AI 周报',
  description:
    'AIHOT 每周回顾：一周内最重要的 AI 模型发布、产品更新、行业变化与论文，按重要度排序，每条附原文。',
  },
  '/news/weekly',
);

/**
 * 周报索引。最新一期做成大卡片，往期按周倒序列出。
 *
 * 版心 2026-10-18 从 1088 改到 1760：频道里其它四个分区（资讯流、日报、
 * 归档）都是 1760，只有周报/月报/热点停在阅读宽度，切标签时报头宽度
 * 会突然缩掉 672px —— 读者感觉「换了个站」，而空出来的宽度也没被用上，
 * 最新一期卡片右侧整块是空的。现在与全频道同宽，卡片内部改用
 * 「上文字、下账目」的两段式（与日报最新一期完全同一套版式），
 * 往期改成两列索引，长标题才有地方展开。
 */
export default function WeeklyIndexPage() {
  const [latest, ...rest] = weeklyReports;
  const latestStats = latest ? periodStats(latest) : null;

  return (
    <div className="pb-16">
      <NewsTabs active="weekly" width="content" />

      <NewsMasthead
        width="content"
        eyebrow="AIHOT · 每周回顾"
        title="AI 周报"
        description="一周过去，哪些模型真的落地、哪些只是噪音。周报把当周最重要的条目按重要度排好，每栏先给一句小结，再逐条附原文。"
        icon={<CalendarRange className="h-3.5 w-3.5" />}
      >
        <MastheadMeta>
          <span>
            已收录 <strong className="font-semibold text-[#F2EEE6]">{weeklyReports.length}</strong> 期
          </span>
          <span>每周一更新</span>
          {latest && <span>最新：{formatWeek(latest.week)}</span>}
        </MastheadMeta>
      </NewsMasthead>

      <div className="content-container">
        {!latest ? (
          <p className="py-20 text-center text-sm text-muted-foreground">暂时没有周报数据。</p>
        ) : (
          <>
            <Reveal as="section" className="mt-8">
              <Link
                href={`/news/weekly/${latest.week}`}
                className="ink-band group relative block overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#1B2523]/25 active:translate-y-0 md:p-8"
              >
                {/* 卡片是一张封面：左边讲什么（标题/导语/入口），右边的书脊
                    竖着排「分几栏 + 多少量」。书脊撑满卡片高度，宽屏上不再
                    剩下半张空的卡片（见 `IssueContents` 的注释）。 */}
                <div className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10 2xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:gap-14">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-[#F2EEE6] px-2.5 py-1 font-semibold text-[#1B2523]">
                        最新一期
                      </span>
                      <span className="text-[#F2EEE6]/55">{formatWeek(latest.week)}</span>
                      <span className="text-[#F2EEE6]/55">
                        {formatPeriodRange(latest.periodStart, latest.periodEnd)}
                      </span>
                    </div>
                    <h2 className="max-w-[40ch] text-balance font-display text-2xl leading-[1.22] text-[#F2EEE6] transition-colors group-hover:text-white md:text-[30px] 2xl:text-[42px]">
                      <HeadlineText text={latest.headline ?? formatWeek(latest.week)} />
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

                  {/* 书脊：目录在上、体量数字在下，中间一道横线；桌面端左侧
                      立一道竖线与正文分开。手机上它退回成卡片底部的一段，
                      顺序仍是「目录 → 数字」。 */}
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
                  {/* 与日报「全部往期」同一档：页底横带标题 19px 半粗。
                      原先 12px 大写小字，和右侧「共 N 期」挤成了同一级。 */}
                  <h2 className="text-[19px] font-semibold text-foreground">往期周报</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    共 {rest.length} 期
                  </span>
                </div>
                {/* 与日报的「全部往期」同一个列表语言：无分隔线的紧凑行，
                    悬停整行变色。宽屏两列，长标题才有展开的余地。 */}
                <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {rest.map((w, i) => {
                    const stats = periodStats(w);
                    return (
                      <li key={w.week} className="min-w-0">
                        <Reveal delay={Math.min(i, 6)}>
                          <Link
                            href={`/news/weekly/${w.week}`}
                            className="group flex items-baseline gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-foreground/[0.04]"
                          >
                            {/* 96px + nowrap：「2026 年第 40 周」在 12px 下约 85px，
                                w-20（80px）会让「周」字折到第二行，整列日期错位。 */}
                            <span className="w-24 shrink-0 whitespace-nowrap text-xs tabular-nums text-gongke-accent">
                              {formatWeek(w.week)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground/75 transition-colors group-hover:text-foreground">
                              {w.headline ?? '（无头条）'}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {stats.items} 条
                            </span>
                          </Link>
                        </Reveal>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}

        <p className="mt-10 border-t border-foreground/10 pt-5 text-xs text-muted-foreground">
          周报由{' '}
          <a
            href="https://aihot.news/weekly"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
          >
            AIHOT
          </a>{' '}
          汇总当周日报生成，本站仅作聚合展示。
        </p>
      </div>
    </div>
  );
}
