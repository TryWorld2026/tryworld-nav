import type { MetadataRoute } from 'next';
import { SITE, categories, collections, tools } from '@/lib/data';
import { dailyArchive, monthlyReports, weeklyReports } from '@/lib/daily-data';

// Required by `output: 'export'`: without it Next treats the sitemap as a
// request-time route and refuses to emit it as a file.
export const dynamic = 'force-static';

const STATIC_ROUTES = [
  '/',
  '/tools',
  '/categories',
  '/collections',
  '/news',
  '/news/daily',
  '/news/daily/archive',
  '/news/weekly',
  '/news/monthly',
  '/news/hot',
  '/about',
  '/terms-conditions',
  '/privacy-policy',
];

/**
 * One timestamp for the whole sitemap, pinned to the catalog refresh rather
 * than read per request: a `new Date()` inside the callback makes lastModified
 * churn on every crawl, which tells search engines that everything changed.
 * Bump it when data/ is re-harvested.
 */
const CATALOG_UPDATED = new Date('2026-10-13T00:00:00+08:00');

/**
 * `generatedAt` 是 ISO 字符串，但坏数据（或空串）会让 `new Date()` 变成
 * `Invalid Date`，而 sitemap 里出现一个非法 lastModified 会让整份 XML 校验
 * 失败。这里统一兜底到 `CATALOG_UPDATED`。
 */
function safeDate(iso: string | null | undefined): Date {
  if (!iso) return CATALOG_UPDATED;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? CATALOG_UPDATED : d;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_ROUTES.map((route) => ({
      url: `${SITE.url}${route}`,
      lastModified: CATALOG_UPDATED,
      changeFrequency: 'daily' as const,
      priority: route === '/' ? 1 : 0.8,
    })),
    ...categories.map((c) => ({
      url: `${SITE.url}/categories/${c.slug}`,
      lastModified: CATALOG_UPDATED,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    // Collection pages sit at the same level of the origin's own sitemap as the
    // category pages, and are curated by hand rather than generated, so they
    // outrank the 2081 tool entries.
    ...collections.map((c) => ({
      url: `${SITE.url}/collections/${c.slug}`,
      lastModified: CATALOG_UPDATED,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // 日报 / 周报 / 月报的每一期都是站内独立页面（有标题、canonical 与正文），
    // 所以进 sitemap；而 /news 卡片流里的条目是外链原文，站内没有对应页面，
    // 不进 —— 把外链塞进本站 sitemap 是错的，那些 URL 不属于本域。
    // 日报的 lastModified 用当期生成时间，让搜索引擎知道这一页确实更新过。
    ...dailyArchive.map((e) => ({
      url: `${SITE.url}/news/daily/${e.date}`,
      lastModified: safeDate(e.generatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...weeklyReports.map((w) => ({
      url: `${SITE.url}/news/weekly/${w.week}`,
      lastModified: safeDate(w.generatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...monthlyReports.map((m) => ({
      url: `${SITE.url}/news/monthly/${m.month}`,
      lastModified: safeDate(m.generatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...tools.map((t) => ({
      url: `${SITE.url}/tools/${t.slug}`,
      lastModified: CATALOG_UPDATED,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
