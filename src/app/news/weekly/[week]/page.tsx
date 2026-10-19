import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { NewsPeriodPage } from '@/components/news-period-page';
import { weeklyReports } from '@/lib/daily-data';
import { formatWeek } from '@/lib/news-period';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export function generateStaticParams() {
  return weeklyReports.map((w) => ({ week: w.week }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ week: string }>;
}): Promise<Metadata> {
  const { week } = await params;
  const report = weeklyReports.find((w) => w.week === week);
  if (!report) return { title: '周报未找到' };
  const title = `AI 周报 · ${formatWeek(week)}`;
  const description = report.headline ?? report.overview?.slice(0, 120) ?? '每周 AI 行业回顾';
  return withOg(
    {
      ...canonical(`/news/weekly/${week}`),
      title: { absolute: `${title} | AIHOT 每周回顾` },
      description,
    },
    `/news/weekly/${week}`,
    { ogType: 'article', publishedTime: report.generatedAt ?? undefined },
  );
}

export default async function WeeklyIssuePage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const idx = weeklyReports.findIndex((w) => w.week === week);
  if (idx < 0) notFound();
  const report = weeklyReports[idx];
  // 数组最新在前：idx+1 是上一周（更旧），idx-1 是下一周（更新）。
  const prev = weeklyReports[idx + 1] ?? null;
  const next = weeklyReports[idx - 1] ?? null;

  return (
    <div className="pb-16">
      <NewsTabs active="weekly" width="period" />
      <div className="period-container mb-4">
        <Link
          href="/news/weekly"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          AI 周报 · 全部期次
        </Link>
      </div>
      <NewsPeriodPage
        report={report}
        kind="weekly"
        prev={prev ? { href: `/news/weekly/${prev.week}`, label: formatWeek(prev.week) } : null}
        next={next ? { href: `/news/weekly/${next.week}`, label: formatWeek(next.week) } : null}
      />
    </div>
  );
}
