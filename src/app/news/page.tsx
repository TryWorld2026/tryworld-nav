import type { Metadata } from 'next';
import { LayoutList, Newspaper } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { NewsFeed } from '@/components/news-feed';
import { MastheadMeta, NewsMasthead } from '@/components/news-masthead';
import { newsItems } from '@/lib/data';
import { newsToolLinks } from '@/lib/news-links';
import { formatDateShort } from '@/lib/news';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical('/news'),
  title: 'AI 资讯',
  description:
    'AI 行业资讯聚合：AIHOT 精选的模型发布、产品更新、行业动态、论文与观点。可按分类、来源、时间筛选，也可切换 AI 日报、周报、月报与热点榜。',
  },
  '/news',
);

/**
 * /news —— 资讯频道首页（资讯流）。
 *
 * 这个路由现在是**一个栏目，而不是一张列表**：顶部 `NewsTabs` 把五个分区
 * （资讯流 / 日报 / 周报 / 月报 / 热点）串起来，读者进来先看到最近 7 天的
 * 精选卡片流，也能一键切到已经编排好的日报。
 *
 * 服务端只做一件事：把 `newsItems` 全量交给客户端组件（约 125 条、120 KB
 * 未压缩，gzip 后十几 KB）。筛选、搜索、分页都在浏览器里完成 —— 静态导出
 * 没有服务端，这也是唯一能保留「即时响应」的做法（与 `/tools` 一致）。
 *
 * 页头放三个「今天有什么」的即时入口：最新一期日报、当前最热一条、以及
 * 热点榜。它们让这个页面不只是列表，而是频道的入口。
 */
export default function NewsIndexPage() {
  // 报头右栏的速览卡已经各自带着「最新日报」与「此刻最热」的标题，元信息
  // 再复述一遍就是同一句话在一个墨块里出现两次 —— 2026-10-18 之前这里正是
  // 如此。现在元信息只交代**这一栏有多少、覆盖多广**：条数、来源数、最新一条。
  const sourceCount = new Set(newsItems.map((it) => it.source).filter(Boolean)).size;
  const newest = newsItems
    .map((it) => it.publishedAt ?? '')
    .filter(Boolean)
    .sort()
    .pop();

  /**
   * 传给客户端组件的「现在」= 构建时刻。
   *
   * 这个值会被烘焙进 HTML，服务端渲染与客户端首次水合都读到它，所以两边的
   * 相对标签必然一致。若让客户端自己 `new Date()`，跨过午夜后服务端写的
   * 「今天」与客户端算出的「昨天」不符，React 报 #418 并丢弃整棵 DOM。
   * `NewsFeed` 挂载后会把它升级成真实当前时间。
   */
  const buildTime = new Date().toISOString();

  return (
    <div className="pb-16">
      <NewsTabs active="feed" width="content" />

      <NewsMasthead
        width="content"
        eyebrow="AIHOT · 精选资讯"
        title="AI 资讯"
        description="最近 7 天 AI 圈值得一读的消息，按时间倒序、按天分组。点标题直接打开原文，每条都标了来源与入选理由。"
        icon={<LayoutList className="h-3.5 w-3.5" />}
      >
        <MastheadMeta>
          <span className="inline-flex items-center gap-1.5">
            <Newspaper className="h-3 w-3" aria-hidden="true" />
            {newsItems.length} 条精选
          </span>
          <span>{sourceCount} 个来源</span>
          {newest && <span>最近更新 {formatDateShort(newest)}</span>}
        </MastheadMeta>
      </NewsMasthead>

      {/* 这里**不再**套容器：`NewsFeed` 自己的筛选条与列表都是
          `.content-container`（1760），与上方报头同宽。原先外面又套了一层
          同宽容器，它不改变任何子元素宽度，只在这个位置留下一块多余的盒子 ——
          量宽度时会被误读。没有数据的空态需要自己的容器，所以单独给。 */}
      <div className="pt-5">
        {newsItems.length === 0 ? (
          <p className="content-container py-20 text-center text-sm text-muted-foreground">
            暂时没有资讯。数据由构建前的 <code>scripts/fetch-aihot.mjs</code> 抓取。
          </p>
        ) : (
          <NewsFeed items={newsItems} toolLinks={newsToolLinks(newsItems)} buildTime={buildTime} />
        )}
      </div>
    </div>
  );
}
