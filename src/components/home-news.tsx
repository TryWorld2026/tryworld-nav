import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, Flame, Newspaper } from 'lucide-react';
import { newsItems } from '@/lib/data';
import { latestDaily, hotTopics } from '@/lib/daily-data';
import { categoryTone, formatDateShort } from '@/lib/news';
import { formatDateFull, weekdayZh } from '@/lib/news-period';
import { HeadlineText } from './headline-text';

/**
 * 首页的「AI 资讯」模块。
 *
 * 用户的原话是「界面上看不到新闻资讯的按钮和界面」。上一轮加了四个入口
 * （顶栏、侧栏、hero、页脚），但那都是**导航按钮**；首页正文里仍然没有任何
 * 资讯内容。这个模块补上内容本身：今天日报的头条 + 最新三条资讯 + 此刻最热，
 * 读首页的人不用先点进频道就知道「今天 AI 圈发生了什么」。
 *
 * 位置：放在「最新添加」之后、26 个分类之前。理由是从上到下是
 * 「热门 → 最新 → **资讯** → 按分类逛」，资讯插在「逛」之前，既不被淹没在
 * 长分类列表里，也不打断工具发现的主路径。
 *
 * 形态是**浅色卡片行**而不是另一种网格：工具卡是白底 + 魔边框，资讯卡用
 * 骨白底 + 左侧分类色条，两类卡片一眼可分。手机上横向滑动，桌面上三列栅格 ——
 * 与日报频道的「最近几期」同一套节奏。
 */
export function HomeNews() {
  const daily = latestDaily();
  const hot = hotTopics[0];
  const latest = newsItems.slice(0, 3);

  if (!daily && latest.length === 0) return null;

  return (
    <section className="pb-0 pt-12" aria-labelledby="home-news-heading">
      <div className="content-container">
        {/* 与站内 SectionHeader 同一套层级（图标块 + 标题 + 发丝线 + 右侧入口），
            不能直接复用组件：这里的入口文案是「进入资讯频道」，而右侧还要挂一个
            「每日更新」的徽章。 */}
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="home-news-heading"
            className="flex shrink-0 items-center gap-2.5 text-[19px] font-semibold text-foreground"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gongke-accent/[0.07] text-gongke-accent ring-1 ring-inset ring-gongke-accent/10"
              aria-hidden="true"
            >
              <Newspaper className="h-4 w-4" />
            </span>
            AI 资讯
            <span className="ml-1 rounded-full bg-gongke-accent/10 px-2 py-0.5 text-[11px] font-medium text-gongke-accent">
              每日更新
            </span>
          </h2>
          <span className="h-px min-w-4 flex-1 bg-foreground/10" aria-hidden="true" />
          <Link
            href="/news"
            className="group hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-gongke-accent md:inline-flex"
          >
            进入资讯频道
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.15fr_2fr]">
          {/* 今日日报：主卡。用墨色而不是品牌绿 —— 绿是「动作色」，整块绿色
              会和站内所有按钮抢同级；墨色是「阅读面」，与首页 hero 的墨块
              呼应，读者一眼知道「这块是今天的内容」。 */}
          {daily && (
            <Link
              href={`/news/daily/${daily.date}`}
              className="ink-band group relative flex flex-col justify-between overflow-hidden rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#1B2523]/25 active:translate-y-0 active:scale-[0.995]"
            >
              <div className="relative">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-[#F2EEE6]/60">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  今日日报 · {formatDateShort(daily.date)} {weekdayZh(daily.date)}
                </p>
                <h3 className="mt-2 line-clamp-3 font-display text-lg leading-snug text-[#F2EEE6] transition-colors group-hover:text-white">
                  {daily.lead?.title ? (
                    <HeadlineText text={daily.lead.title} />
                  ) : (
                    `${formatDateFull(daily.date)} 的 AI 日报`
                  )}
                </h3>
                {daily.lead?.leadParagraph && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#F2EEE6]/60">
                    {daily.lead.leadParagraph}
                  </p>
                )}
              </div>
              <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#F2EEE6]/85">
                阅读本期
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          )}

          {/* 最新资讯：三条紧凑卡片 */}
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {latest.map((it) => {
              const tone = categoryTone(it.category);
              return (
                <a
                  key={it.id}
                  href={it.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-foreground/10 bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md active:translate-y-0 active:scale-[0.995]"
                >
                  <span
                    className="absolute inset-y-0 left-0 w-[2.5px]"
                    style={{ background: tone.bar }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 font-medium"
                        style={{ background: tone.wash, color: tone.text }}
                      >
                        {it.categoryLabel}
                      </span>
                      <span className="text-muted-foreground">{formatDateShort(it.publishedAt)}</span>
                    </p>
                    <h3 className="mt-1.5 line-clamp-3 text-sm font-semibold leading-snug text-foreground/85 transition-colors group-hover:text-gongke-accent">
                      <HeadlineText text={it.title} />
                    </h3>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="min-w-0 truncate">{it.source}</span>
                    <ArrowUpRight
                      className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-70"
                      aria-hidden="true"
                    />
                  </p>
                </a>
              );
            })}
          </div>
        </div>

        {/* 底栏：更多入口 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/news/hot"
            className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/30 hover:shadow-sm active:translate-y-0"
          >
            <Flame className="h-3 w-3 shrink-0 text-[#B54826]" aria-hidden="true" />
            <span className="font-medium text-[#B54826]">此刻最热</span>
            {hot && <span className="min-w-0 truncate text-foreground/70">{hot.title}</span>}
          </Link>
          <Link
            href="/news/weekly"
            className="rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-xs text-foreground/65 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/30 hover:shadow-sm active:translate-y-0"
          >
            本周回顾
          </Link>
          <Link
            href="/news/daily/archive"
            className="rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-xs text-foreground/65 transition-all duration-200 hover:-translate-y-0.5 hover:border-gongke-accent/30 hover:shadow-sm active:translate-y-0"
          >
            全部往期
          </Link>
          <Link
            href="/news"
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            资讯频道
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
