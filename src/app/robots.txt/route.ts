import { SITE } from '@/lib/site';

/**
 * robots.txt, served as raw text because the origin emits two non-standard
 * directives (`LLM-Content`, `LLM-Full-Content`) that Next's typed
 * `robots.ts` generator has no field for. Everything below is the origin's
 * file, with the host substituted so the replica does not advertise URLs it
 * does not own.
 *
 * The five AI crawlers are allowed exactly one path and nothing else: the
 * origin serves /llms.txt to them and denies the rest of the site, so a
 * replica that let them roam would publish more than the original.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const body = [
    'User-Agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /user/',
    'Disallow: /verify-email/',
    'Disallow: /reset-password/',
    // `/offline` 是断网时才显示的兜底页，页内已经把 title 与 body 写成
    // 「你断网了」。抓进去只会让搜索结果标题里多一句错误提示 —— 它本身
    // 也带 `<meta name="robots" content="noindex">`，这里是双保险。
    // 只 Disallow 这一条，不顺手把 `/sw.js` 也拦掉：SW 脚本被拦不影响
    // 爬虫（爬虫不跑 SW），但拦了以后人工排查「线上能否装上」会看不见它。
    'Disallow: /offline',
    '',
    'User-Agent: GPTBot',
    'Allow: /llms.txt',
    'Disallow: /',
    '',
    'User-Agent: anthropic-ai',
    'Allow: /llms.txt',
    'Disallow: /',
    '',
    'User-Agent: Google-Extended',
    'Allow: /llms.txt',
    'Disallow: /',
    '',
    'User-Agent: ClaudeBot',
    'Allow: /llms.txt',
    'Disallow: /',
    '',
    // Googlebot gets the same treatment as `*` — spelled out separately
    // because the origin does, and a later group wins for a crawler that
    // matches both.
    'User-Agent: Googlebot',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /user/',
    'Disallow: /verify-email/',
    'Disallow: /reset-password/',
    'Disallow: /offline',
    '',
    `Sitemap: ${SITE.url}/sitemap.xml`,
    '',
    `LLM-Content: ${SITE.url}/llms.txt`,
    `LLM-Full-Content: ${SITE.url}/llms-full.txt`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
