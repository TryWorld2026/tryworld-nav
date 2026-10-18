import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

/**
 * `alternates.canonical` for one route, merged into whatever metadata the page
 * already returns.
 *
 * The site ships 2135 pages and not one of them carried a `rel="canonical"`
 * before this helper existed — every URL was its own authority, so `/tools/x`
 * and `/tools/x.html` (which the Worker 307s to `/tools/x`) and any future
 * query-string variant each competed for the same content.
 *
 * `SITE.url` is `https://nav.tryworld.com.cn` and `layout.tsx` sets
 * `metadataBase` to the same value, so the absolute URL here is unambiguous.
 * Trailing slashes are not added: the sitemap and the Worker both use the
 * slash-less form, and a canonical that disagrees with the sitemap is worse
 * than none.
 */
export function canonical(path: string): Pick<Metadata, 'alternates'> {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
  return { alternates: { canonical: `${SITE.url}${normalized}` } };
}
