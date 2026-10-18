import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewsTabs } from '@/components/news-tabs';
import { NewsPeriodPage } from '@/components/news-period-page';
import { monthlyReports } from '@/lib/daily-data';
import { formatMonth } from '@/lib/news-period';
import { canonical } from '@/lib/canonical';

export function generateStaticParams() {
  return monthlyReports.map((m) => ({ month: m.month }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  const report = monthlyReports.find((m) => m.month === month);
  if (!report) return { title: '月报未找到' };
  const title = `AI 月报 · ${formatMonth(month)}`;
  const description = report.headline ?? report.overview?.slice(0, 120) ?? '每月 AI 行业回顾';
  return {
    ...canonical(`/news/monthly/${month}`),
    title: { absolute: `${title} | AIHOT 每月回顾` },
    description,
  };
}

export default async function MonthlyIssuePage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const idx = monthlyReports.findIndex((m) => m.month === month);
  if (idx < 0) notFound();
  const report = monthlyReports[idx];
  const prev = monthlyReports[idx + 1] ?? null;
  const next = monthlyReports[idx - 1] ?? null;

  return (
    <div className="pb-16">
      <NewsTabs active="monthly" width="period" />
      <div className="period-container mb-4">
        <Link
          href="/news/monthly"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          AI 月报 · 全部期次
        </Link>
      </div>
      <NewsPeriodPage
        report={report}
        kind="monthly"
        prev={prev ? { href: `/news/monthly/${prev.month}`, label: formatMonth(prev.month) } : null}
        next={next ? { href: `/news/monthly/${next.month}`, label: formatMonth(next.month) } : null}
      />
    </div>
  );
}
