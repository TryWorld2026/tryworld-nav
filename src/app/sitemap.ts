import type { MetadataRoute } from 'next';
import { SITE, categories, collections, tools } from '@/lib/data';

// Required by `output: 'export'`: without it Next treats the sitemap as a
// request-time route and refuses to emit it as a file.
export const dynamic = 'force-static';

const STATIC_ROUTES = [
  '/',
  '/tools',
  '/categories',
  '/collections',
  '/news',
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
    // 资讯条目不再进 sitemap：/news 现在是 AIHOT 精选的外链卡片流，站内没有
    // /news/{slug} 页面可索引（详情页已于 2026-10-15 移除），而把外链原文塞进
    // 本站 sitemap 是错的——那些 URL 不属于本域。索引页本身留在 STATIC_ROUTES。
    ...tools.map((t) => ({
      url: `${SITE.url}/tools/${t.slug}`,
      lastModified: CATALOG_UPDATED,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
