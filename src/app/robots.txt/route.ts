import { SITE } from '@/lib/site';

/**
 * robots.txt, served as raw text because the origin emits two non-standard
 * directives (`LLM-Content`, `LLM-Full-Content`) that Next's typed
 * `robots.ts` generator has no field for. Everything below is the origin's
 * file, with the host substituted so the replica does not advertise URLs it
 * does not own.
 *
 * Two things the origin's file does not cover, both of which are
 * launch-blocking for this replica:
 *
 * 1. **Cloudflare injects a managed block at the edge.** When the zone has
 *    "AI Crawl Control" on, Cloudflare *prepends* a "Cloudflare Managed
 *    content" section to whatever the Worker serves — including
 *    `User-agent: Baiduspider` / `Disallow: /`. For a Chinese-language
 *    directory that reads as "Baidu must not index this site at all".
 *    Crawlers merge groups that share a user-agent token (Google and Bing
 *    document this), and the least restrictive rule wins, so declaring
 *    `Allow: /` for Baiduspider here overrides Cloudflare's blanket
 *    `Disallow: /` for those crawlers. Crawlers that instead honour the
 *    *first* matching group (and Python's `urllib.robotparser`, for one)
 *    would still see Cloudflare's block first — so the zone setting itself
 *    still has to be turned off. See DEPLOY.md → "robots.txt 与 Cloudflare".
 *
 * 2. **The AI-crawler policy is stated for five crawlers only**, so every
 *    other scraper falls through to `User-Agent: *` and may re-crawl 2 000+
 *    tool pages instead of consuming the curated `/llms.txt`. The groups
 *    below name the training crawlers explicitly, which makes the policy
 *    self-contained: it holds whether or not Cloudflare's managed block is
 *    present.
 */
export const dynamic = 'force-static';

/** Paths the AI crawlers are allowed to read. Both are advertised below. */
const LLM_PATHS = ['/llms.txt', '/llms-full.txt'];

/** Search engines we want indexed, spelled out so Cloudflare's block can be overridden. */
const SEARCH_CRAWLERS = [
  'Baiduspider',
  'Sogou',
  '360Spider',
  'Bingbot',
  'Yandex',
  'DuckDuckBot',
  'PetalBot',
];

/** AI scrapers that get the curated text only, not the whole site. */
const AI_CRAWLERS_ALLOWED = [
  'GPTBot',
  'anthropic-ai',
  'ClaudeBot',
  'Google-Extended',
  'GoogleOther',
];

/** AI scrapers with no reason to be here beyond the curated text. */
const AI_CRAWLERS_BLOCKED = [
  'Amazonbot',
  'Applebot-Extended',
  'Bytespider',
  'CCBot',
  'Claude-Web',
  'Diffbot',
  'FacebookBot',
  'Omgili',
  'omgilibot',
  'PerplexityBot',
  'Timpibot',
  'Webzio-Extended',
];

export function GET(): Response {
  const lines: string[] = [];

  lines.push(
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
  );

  // 中文搜索引擎必须显式放行：Cloudflare 的托管块给 Baiduspider 写了
  // `Disallow: /`，而这份文件里如果没有同名 group，爬虫会直接被它挡在
  // 门外。同名 group 合并时「最宽松的一条胜出」，所以这里的 `Allow: /`
  // 能把那条封禁顶掉。
  for (const ua of SEARCH_CRAWLERS) {
    lines.push('User-Agent: ' + ua, 'Allow: /', '');
  }

  // AI 爬虫只给两份 LLM 文本：/llms.txt 是摘要，/llms-full.txt 是全量正文。
  // 两个都在下面用 LLM-Content / LLM-Full-Content 广告过，只放行前者会让
  // 这条广告指向的地址反而不许爬 —— 自己和自己打架。
  for (const ua of AI_CRAWLERS_ALLOWED) {
    lines.push('User-Agent: ' + ua);
    for (const p of LLM_PATHS) lines.push('Allow: ' + p);
    lines.push('Disallow: /', '');
  }

  // 训练型爬虫：整站不给。原站没写这一段，靠的是上游没这些爬虫；
  // 现在上游有了（而且 Cloudflare 已经在拦它们），把策略写死在仓库里，
  // 站点的立场就不依赖任何面板开关。
  for (const ua of AI_CRAWLERS_BLOCKED) {
    lines.push('User-Agent: ' + ua, 'Disallow: /', '');
  }

  // Googlebot gets the same treatment as `*` — spelled out separately
  // because the origin does, and a later group wins for a crawler that
  // matches both.
  lines.push(
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
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
