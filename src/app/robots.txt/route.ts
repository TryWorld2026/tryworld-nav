import { SITE } from '@/lib/data';

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
