import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { MastheadLink, MastheadMeta, NewsMasthead } from '@/components/news-masthead';
import { IssueContents, IssueCoverlines } from '@/components/issue-contents';
import { Reveal } from '@/components/reveal';
import { dailyArchive, latestDaily, listDailies } from '@/lib/daily-data';
import {
  archiveGroups,
  dailyStats,
  formatDateFull,
  formatDateShort,
  issueNumber,
  weekdayZh,
} from '@/lib/news-period';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical('/news/daily'),
  title: 'AI 日报',
  description:
    '每天 08:00（北京时间）出刊的 AI 行业日报，AIHOT 精编：模型发布、产品更新、行业动态、论文与快讯，每条附原文。可在站内阅读全部往期。',
  },
  '/news/daily',
);

/**
 * /news/daily —— 日报首页。
 *
 * 这里不是把最新一期直接铺开（那是 `/news/daily/[date]` 的职责），而是
 * **读报的姿态**：最新一期做成一张大卡片，下面按月列出全部往期。喜欢追新的
 * 读者一键进最新一期；想补课的读者在这里按日历翻。
 *
 * 之所以要有这一层而不是把 `/news/daily` 重定向到最新一期：日期一旦成为 URL
 * 的一部分，读者会收藏、分享具体某一天；一个永远指向「今天」的入口会让收藏
 * 失效、也让「昨天那期讲什么」无从找回。归档页是链接的锚。
 */
export default function DailyIndexPage() {
  const latest = latestDaily();
  const all = listDailies();
  const groups = archiveGroups(dailyArchive);
  // 第 0 项是上面那张墨色大卡，不参与卡片网格；取 7 期是为了让网格正好铺满
  // 两行三列 —— 只取 6 期时残留 5 张卡，2560 下第二行右下角会空出一个洞。
  const recent = all.slice(0, 7);
  // 只算一次：最新一期的四个统计数字同时用在墨色大卡与（未来的）统计条上。
  const latestStats = latest ? dailyStats(latest) : null;

  return (
    <div className="pb-16">
      <NewsTabs active="daily" width="content" />

      <NewsMasthead
        width="content"
        eyebrow="AIHOT · 每日要闻"
        title="AI 日报"
        description="每天 08:00（北京时间）出刊，把前一天散落在几十个来源里的 AI 动态收成一期：模型与产品发布、行业变化、论文、快讯。每条都带原文链接，可在本站读完全部往期。"
        icon={<Newspaper className="h-3.5 w-3.5" />}
      >
        <MastheadMeta>
          <span>
            已出刊 <strong className="font-semibold text-[#F2EEE6]">{dailyArchive.length}</strong> 期
          </span>
          {latest && (
            <span>
              最新：{formatDateFull(latest.date)}（{weekdayZh(latest.date)}）
            </span>
          )}
          <MastheadLink href="/news/hot">看此刻热点</MastheadLink>
        </MastheadMeta>
      </NewsMasthead>

      {/* 站内通用内容宽度（1760），与频道栏、报头同一把尺子。
          2026-10-18 之前这里是 1088：2560 下正文只占可用宽度的 44%，两侧
          各 640px 空白，而**归档页**（`/news/daily/archive`）一直是 1760
          的三列矩阵 —— 同一栏目里两个入口的版心差 672px，切过去像换了个站。
          最新一期大卡本来就是左文右数的两栏结构，铺开后头条与统计各归其位；
          「全部往期」的日期 + 标题单行列表则加一列来消化多出来的宽度，
          而不是把每一行拉长。 */}
      <div className="content-container">
        {/* 最新一期：墨色大卡。原先是白卡 —— 在骨白页面上它就是一块更白的
            方块，右边 60% 全空，读者第一眼找不到「今天讲什么」。现在用整块
            墨色 + 左文右数的两栏：左栏是头条，右栏是这一期的体量统计。 */}
        {latest && (
          <Reveal as="section" className="mt-8">
            <Link prefetch={false}
              href={`/news/daily/${latest.date}`}
              className="ink-band group relative block overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#1B2523]/25 active:translate-y-0 md:p-8"
            >
              {/* 与周报/月报同一张封面：左边讲什么，右边书脊竖排「本期版面 +
                  体量数字」。快讯不占版面，但该被看见，跟在版面清单末尾。 */}
              <div className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10 2xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:gap-14">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[#F2EEE6] px-2.5 py-1 font-semibold text-[#1B2523]">
                      最新一期
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#F2EEE6]/55">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      {formatDateFull(latest.date)} · {weekdayZh(latest.date)}
                    </span>
                    <span className="text-[#F2EEE6]/55">
                      第 {issueNumber(dailyArchive, latest.date)} 期
                    </span>
                  </div>
                  <h2 className="max-w-[46ch] text-balance font-display text-2xl leading-[1.22] text-[#F2EEE6] transition-colors group-hover:text-white md:text-[30px] 2xl:text-[42px]">
                    {latest.lead?.title ?? '今日无大事发生'}
                  </h2>
                  {latest.lead?.leadParagraph && (
                    <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[#F2EEE6]/60 md:text-[15px] 2xl:max-w-[44rem] 2xl:text-[16px]">
                      {latest.lead.leadParagraph}
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
                      items={latest.sections.flatMap((s) => s.items).filter((it) => it.title !== latest.lead?.title)}
                    />
                </div>

                <div className="mt-7 min-w-0 border-t border-white/15 pt-5 lg:mt-0 lg:border-t-0 lg:border-l lg:pl-9 lg:pt-0 2xl:pl-12">
                  <IssueContents
                    sections={latest.sections}
                    label="本期版面"
                    extra={latest.flashes.length ? [{ label: '快讯', count: latest.flashes.length }] : []}
                  />
                  <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/15 pt-5 sm:grid-cols-4 lg:grid-cols-2">
                    {latestStats &&
                      [
                        ['件大事', latestStats.items],
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
        )}

        {/* 最近几期：横向卡片条（手机上可滑，桌面上是三列网格） */}
        {recent.length > 1 && (
          <section className="mt-10">
            {/* 页底横带标题统一 19px（与紧接着的「全部往期」、分类详情的
                「其他分类」、合集详情的「其他集合」同档）。原来这里是 12px
                大写小字 —— 同一条页面上，相隔 300px 的两条内容带用了两种
                字号，读者会以为「最近几期」只是筛选器旁边的一个说明标签。 */}
            <h2 className="mb-4 text-[19px] font-semibold text-foreground">
              最近几期
            </h2>
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
              {recent.slice(1).map((d, i) => (
                <Reveal
                  key={d.date}
                  delay={i}
                  className="w-[82%] shrink-0 snap-start md:w-auto"
                >
                  <Link prefetch={false}
                    href={`/news/daily/${d.date}`}
                    className="group flex h-full flex-col rounded-xl border border-foreground/10 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md active:translate-y-0"
                  >
                    <span className="text-[11px] font-medium text-gongke-accent">
                      {formatDateShort(d.date)} · {weekdayZh(d.date)}
                    </span>
                    <span className="mt-1.5 line-clamp-2 flex-1 text-sm font-medium leading-snug text-foreground/80 transition-colors group-hover:text-foreground">
                      {d.lead?.title ?? '今日无大事发生'}
                    </span>
                    <span className="mt-2 text-[11px] text-muted-foreground">
                      第 {issueNumber(dailyArchive, d.date)} 期
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* 全部往期：按月分组 */}
        <section className="mt-12">
          <h2 className="mb-4 text-[19px] font-semibold text-foreground">全部往期</h2>
          <div className="space-y-6">
            {groups.map((g, gi) => (
              <details key={g.key} open={gi < 2} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border-b border-foreground/10 pb-2 text-sm font-semibold text-foreground/80 [&::-webkit-details-marker]:hidden">
                  <span>{g.label}</span>
                  <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                    {g.days.length} 期
                    <span className="transition-transform duration-200 group-open:rotate-90">›</span>
                  </span>
                </summary>
                {/* 必须显式写 `grid-cols-1`：Tailwind 的 `grid` 只有
                    `display:grid`，列宽默认 `auto`，会被列表项的最小内容宽度
                    撑到 680px；`grid-cols-1` 展开成 `minmax(0,1fr)` 才收得住。 */}
                <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {g.days.map((d) => (
                    <li key={d.date}>
                      <Link prefetch={false}
                        href={`/news/daily/${d.date}`}
                        className="flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
                      >
                        {/* `w-14` 在 12px 下装不下「10月17日」（约 66px），
                            日期会折成「10月17 / 日」两行，整列行高就散了。
                            `w-16` + `whitespace-nowrap` 一起给足。 */}
                        <span className="w-16 shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                          {formatDateShort(d.date)}
                        </span>
                        {/* `min-w-0` + `truncate` 缺一不可：flex 子项默认按内容
                            撑开，中文标题没有空格可断行时会撑到 680px。 */}
                        <span className="min-w-0 flex-1 truncate">{d.leadTitle ?? '（无头条）'}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-10 border-t border-foreground/10 pt-5 text-xs leading-relaxed text-muted-foreground">
          日报内容来自{' '}
          <a
            href="https://aihot.news/daily"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
          >
            AIHOT
          </a>
          （AIHOT 根据公开报道自动整理，每条都附原文）。本站仅作聚合展示，版权归各来源与原作者所有。
        </p>
      </div>
    </div>
  );
}
