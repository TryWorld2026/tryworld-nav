import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Flame, Radio, Users } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { MastheadMeta, NewsMasthead } from '@/components/news-masthead';
import { Reveal } from '@/components/reveal';
import { hotTopics, dailyFetchedAt } from '@/lib/daily-data';
import { dayKey, weekdayOf } from '@/lib/news';
import { beijingTime, hotBarWidth } from '@/lib/news-period';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical('/news/hot'),
  title: 'AI 热点榜',
  description:
    '此刻 AI 圈最热的十条动态：AIHOT 跨来源统计的信号量、参与来源与最新时间，按热度排序，每条附原文。',
  },
  '/news/hot',
);

/**
 * 热点榜 —— 资讯频道的「此刻」视角。
 *
 * 与日报的区别：日报是**已经编排过**的一天，热点榜是**正在发生**的聚合。
 * 数据来自 AIHOT `/hot-topics`，每条带 `signalCount`（跨来源信号数）、
 * `sourceCount`（报道来源数）、`participantCount`（观察到的参与者）与
 * `sourceNames`（具体是哪些来源在说）。
 *
 * 视觉上用条形图而不是纯列表：热度是相对量，一条 40px 的横条比「热度 65」
 * 这样的数字更直觉。条形宽度相对榜首归一化（`hotBarWidth`），颜色只用品牌
 * 绿——不用红黄渐变，那会让页面像资讯聚合站而不是这个站的克制风格。
 *
 * 榜单一共 10 条，不需要分页与筛选，所以这是一张静态页，唯一的数据新鲜度
 * 信息放在页脚的「更新于」。
 */
export default function HotTopicsPage() {
  const updateTime = beijingTime(dailyFetchedAt);
  // 日期必须用 `dayKey`（ISO 瞬间 → 北京日历日），不能 `slice(0,10)`。
  // `dailyFetchedAt` 是 UTC ISO 串，`slice(0,10)` 取的是 **UTC 日**；
  // 而 `updateTime` 走 `beijingTime`，是**北京时**——两者混用，同一行里
  // 日期和时间差一天，而末尾还标着「（北京时间）」。
  // 抓取落在 UTC 16:00–24:00（北京 00:00–08:00）时就会错；
  // `npm run build` 的第二步就是抓取，凌晨构建必中。
  const updateDate = dayKey(dailyFetchedAt);

  return (
    <div className="pb-16">
      <NewsTabs active="hot" width="content" />

      <NewsMasthead
        width="content"
        eyebrow="AIHOT · 此刻最热"
        title="AI 热点榜"
        description="跨来源统计此刻 AI 圈讨论最集中的十条。热度来自 AIHOT 对多个来源的信号汇总，不是本站的编辑判断；每条都能点进原文。"
        icon={<Flame className="h-3.5 w-3.5" />}
      >
        {updateDate && (
          <MastheadMeta>
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-[#F2A07F]" aria-hidden="true" />
              榜单随构建刷新
            </span>
            <span>
              数据更新于 {updateDate} {updateTime && ` ${updateTime}`}（北京时间）
            </span>
          </MastheadMeta>
        )}
      </NewsMasthead>

      {/* 榜单在 1760 下不再是「一条被拉长的卡」：标题留在左端，信号 / 来源 /
          时间被推到右端并成一行，十行读下来数字是齐的，才像一块榜。
          2026-10-18 之前这一栏停在 1088 —— 与频道其它分区不同宽，切标签时
          版心会突然缩进去一截；而 1088 下标题与「N 家来源」本来就隔着一屏。 */}
      <div className="content-container">
        {hotTopics.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">暂时没有热点数据。</p>
        ) : (
          <ol className="mt-8 space-y-2.5">
            {hotTopics.map((t, i) => {
              const width = hotBarWidth(t, hotTopics);
              const href = t.links.original ?? t.links.aihot ?? '#';
              return (
                <li key={t.id}>
                  <Reveal delay={Math.min(i, 8)}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block overflow-hidden rounded-xl border border-foreground/10 bg-card px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/25 hover:shadow-md active:translate-y-0 active:scale-[0.995]"
                    >
                      {/* 热度条：贴在卡片底边的一道 3px 实线，长度相对榜首归一化。
                          2026-10-18 之前它是「铺满整行高度 + 右端一道实边」——
                          手机上还成立，1440 下每一行的实边都落在右半边的
                          「N 个信号 / N 家来源」中间，2px 橙线把字切开，十条
                          并排看像被同一把尺子划了十刀。贴底以后没有任何一条
                          线穿过文字，`长度 + 硬右端` 的读法仍然成立，卡片的
                          `overflow-hidden` 与圆角顺便把左端收干净。
                          右端不需要再画边：实色条的末端本身就是刻度。 */}
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-0 h-[3px] bg-gongke-accent/45 transition-all duration-500 group-hover:bg-gongke-accent/60"
                        style={{ width: `${width}%` }}
                      />
                      <div className="relative flex items-start gap-3.5">
                        <span
                          className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${
                            i === 0
                              ? 'bg-gongke-accent text-white shadow-sm shadow-gongke-accent/25'
                              : i < 3
                                ? 'bg-card text-gongke-accent ring-1 ring-gongke-accent/30'
                                : 'bg-card text-foreground/60 ring-1 ring-foreground/10'
                          }`}
                        >
                          {/* 徽标底色必须是不透明的：热度条铺满整行，右端那道
                              2px 实边会从半透明的 `bg-foreground/5` 后面穿出来，
                              正好把名次数字切两半（390 下每一行都能看到）。
                              用 `bg-card` 的实底把小方块从条里「挖」出来。 */}
                          {t.rank || i + 1}
                        </span>

                        {/* 宽屏：左标题、右数据。窄屏：数据落到标题下方。
                            同一段标记，靠 `lg:flex` 换排法，不重复渲染。 */}
                        <div className="min-w-0 flex-1 lg:flex lg:items-center lg:gap-10">
                          <div className="min-w-0 lg:flex-1">
                            {/* `text-balance`：390 下三条标题折成两行，末行
                                只剩 1–2 个字（实测 5%、5%、17%）。 */}
                            <h2 className="text-balance text-[15px] font-semibold leading-snug text-foreground/90 transition-colors group-hover:text-gongke-accent md:text-base">
                              {t.title}
                              <ArrowUpRight
                                className="ml-1 inline h-3.5 w-3.5 -translate-y-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60"
                                aria-hidden="true"
                              />
                            </h2>

                            {t.sourceNames.length > 0 && (
                              <p className="mt-1.5 line-clamp-1 text-[12px] text-muted-foreground">
                                {t.sourceNames.slice(0, 6).join(' · ')}
                                {t.sourceNames.length > 6 && ` 等 ${t.sourceNames.length} 家`}
                              </p>
                            )}
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground lg:mt-0 lg:shrink-0 lg:flex-nowrap lg:gap-x-5">
                            <span className="text-foreground/70">{t.source}</span>
                            <span className="inline-flex items-center gap-1">
                              <Flame className="h-3 w-3" aria-hidden="true" />
                              {t.signalCount} 个信号
                            </span>
                            <span>{t.sourceCount} 家来源</span>
                            {t.participantCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" aria-hidden="true" />
                                {t.participantCount} 个参与者
                              </span>
                            )}
                            {t.latestAt && (
                              <span className="tabular-nums">
                                {beijingTime(t.latestAt)}
                                {/* 原来这里是 `weekdayZh(...) && ' 最新'` ——
                                    `weekdayZh` 对任何合法日期都返回「周X」，
                                    恒为真，于是十行全都挂着「最新」，等于没写。
                                    而且入参是 `latestAt.slice(0, 10)`，那是
                                    UTC 日期，北京时间 00:00–07:59 会差一天。
                                    改成真的显示送达日：先 `dayKey` 换算成北京
                                    日历日再取星期。 */}
                                {dayKey(t.latestAt) && ` ${weekdayOf(dayKey(t.latestAt))}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </a>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link prefetch={false}
            href="/news/daily"
            className="group flex items-center justify-between rounded-xl border border-foreground/10 bg-card px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/25 hover:shadow-sm active:translate-y-0"
          >
            <span>
              <span className="block text-sm font-medium text-foreground/85">看今天的日报</span>
              <span className="text-xs text-muted-foreground">已经编排好的一天，按栏目阅读</span>
            </span>
            <ArrowUpRight
              className="h-4 w-4 text-gongke-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <Link prefetch={false}
            href="/news"
            className="group flex items-center justify-between rounded-xl border border-foreground/10 bg-card px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/25 hover:shadow-sm active:translate-y-0"
          >
            <span>
              <span className="block text-sm font-medium text-foreground/85">浏览资讯流</span>
              <span className="text-xs text-muted-foreground">近 7 天全部精选，可搜索筛选</span>
            </span>
            <ArrowUpRight
              className="h-4 w-4 text-gongke-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <p className="mt-10 border-t border-foreground/10 pt-5 text-xs leading-relaxed text-muted-foreground">
          热度口径由{' '}
          <a
            href="https://aihot.news/hot"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
          >
            AIHOT
          </a>{' '}
          统计，本站仅作展示；排名不代表本站立场。榜单在每次构建时刷新。
        </p>
      </div>
    </div>
  );
}
