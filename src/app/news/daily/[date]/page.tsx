import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { NewsDailyPage } from '@/components/news-daily-page';
import { dailyArchive, getDaily, latestDailyDate } from '@/lib/daily-data';
import { dailyStats, formatDateFull } from '@/lib/news-period';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

/**
 * 每一期日报一个静态页：`/news/daily/2026-10-17`。
 *
 * 为什么把 179 期都预渲染成独立页面，而不是做成 `/news/daily?date=…`：
 *
 *   1. 静态站没有服务端，查询参数只能在客户端读，首屏会是空壳 —— 日报是长文，
 *      空壳体验很差；
 *   2. 每一期都有自己的标题、描述和 canonical，能被搜索引擎与聊天软件正确
 *      抓取（分享到微信时卡片标题就是当天的头条）；
 *   3. URL 即日期，收藏与回溯都直观。
 *
 * 179 页 × 约 30 KB ≈ 5 MB，对构建与部署都可忽略（全站 2125 个页面、1 GB 媒体）。
 */
export function generateStaticParams() {
  return dailyArchive.map((e) => ({ date: e.date }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  const report = getDaily(date);
  if (!report) return { title: '日报未找到' };

  const stats = dailyStats(report);
  const title = `AI 日报 · ${formatDateFull(date)}`;
  const description =
    report.lead?.title ??
    `AIHOT 精编的 ${formatDateFull(date)} AI 行业日报，共 ${stats.items} 条、来自 ${stats.sources} 个来源，每条附原文。`;

  return withOg(
    {
      ...canonical(`/news/daily/${date}`),
      // 绝对标题：`layout.tsx` 有 `title.template`，这里已经自带站点语义，
      // 不再追加一次站名（与工具页、集合页的处理一致）。
      title: { absolute: `${title} | AIHOT 每日要闻` },
      description,
    },
    `/news/daily/${date}`,
    { ogType: 'article', publishedTime: report.generatedAt ?? undefined },
  );
}

export default async function DailyIssuePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const report = getDaily(date);
  if (!report) notFound();

  return (
    <div className="pb-16">
      <NewsTabs active="daily" width="rail" />

      {/* 与下方正文同一个 `.rail-container`。2026-10-18 起这条阶梯与
          `.content-container` 已经合流（2560 下都是 1760），两者的左右缘
          不再有差；这里仍用 `rail`，是为了让「返回」链接与它统领的正文容器
          在语义上绑在一起 —— 将来日报若单独改成窄栏，链接跟着走，不会
          在左缘分叉。 */}
      <div className="rail-container mb-4">
        <Link prefetch={false}
          href="/news/daily"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          AI 日报 · 全部往期
        </Link>
      </div>

      <NewsDailyPage report={report} archive={dailyArchive} latestDate={latestDailyDate} />
    </div>
  );
}
