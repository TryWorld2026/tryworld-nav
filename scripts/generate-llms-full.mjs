/**
 * Build `public/llms-full.txt` — the "full content" companion to `llms.txt`.
 *
 * `llms.txt` is a short index of categories plus a sample of tools; this is
 * the whole catalog as plain text, one entry per tool, which is what an LLM
 * crawler needs to actually answer questions about the catalog without
 * fetching 2081 pages.
 *
 * Why a script rather than a hand-written file: `data/tool-extras.json` is
 * re-harvested, so the file has to be regenerated or it silently goes stale.
 * The old `public/llms-full.txt` shipped once and was later deleted, while
 * `src/app/robots.txt/route.ts` kept advertising it — a 404 for every
 * crawler that trusted the directive.
 *
 * Usage: node scripts/generate-llms-full.mjs   (run before `next build`)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, 'data');

const readJson = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));

const tools = readJson('tools.json');
const extras = readJson('tool-extras.json');
const index = readFileSync(join(dataDir, 'llms.txt'), 'utf8').trimEnd();

const SITE_URL = 'https://nav.tryworld.com.cn';

// `data/llms.txt` is the origin's own index and every one of its 47 absolute
// links points at `tryworld.com.cn`, the site this one replicates. Publishing
// it verbatim under this host would send every crawler and user that follows
// `llms.txt` back to the origin, so the host is rewritten here rather than
// editing the harvested source (which must stay byte-identical to what was
// crawled).
const retargetIndex = (markdown) =>
  markdown.replace(/\(https:\/\/tryworld\.com\.cn/g, `(${SITE_URL}`);

const stripTags = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

const out = [retargetIndex(index), '', '---', ''];

for (const tool of tools) {
  const e = extras[tool.slug] ?? {};
  const categories = (tool.categories ?? []).map((c) => c.name).join(' / ');
  const price = e.pricing && e.pricing !== '未知' ? e.pricing : '';

  out.push(`## ${tool.name}`);
  out.push('');
  out.push(`- URL: ${SITE_URL}/tools/${tool.slug}`);
  out.push(`- 简介: ${tool.description ?? ''}`);
  if (categories) out.push(`- 分类: ${categories}`);
  if (price) out.push(`- 价格: ${price}`);
  if (e.external) out.push(`- 官网: ${e.external}`);
  if (Array.isArray(e.platforms) && e.platforms.length) {
    out.push(`- 支持平台: ${e.platforms.map((p) => p.text ?? p.name ?? '').filter(Boolean).join('、')}`);
  }
  if (Array.isArray(e.info) && e.info.length) {
    for (const row of e.info) out.push(`- ${row.label ?? ''}: ${row.text ?? ''}`);
  }
  if (typeof e.description === 'string' && e.description.trim()) {
    out.push(`- 详情: ${e.description.trim()}`);
  }
  if (typeof e.prose === 'string' && e.prose.trim()) {
    out.push('', stripTags(e.prose));
  }
  out.push('');
}

const text = `${out.join('\n').replace(/\n{4,}/g, '\n\n\n')}\n`;
writeFileSync(join(root, 'public', 'llms-full.txt'), text, 'utf8');

// `public/llms.txt` used to be a byte-identical copy of `data/llms.txt`, so the
// one file robots.txt actively points crawlers at (`LLM-Content`) still sent
// them to `tryworld.com.cn`. Regenerating it here keeps both files in step and
// keeps the rewrite in one place.
const short = `${retargetIndex(index)}\n`;
writeFileSync(join(root, 'public', 'llms.txt'), short, 'utf8');

const kb = (Buffer.byteLength(text) / 1024).toFixed(0);
console.log(
  `public/llms-full.txt: ${tools.length} tools, ${kb} KB; ` +
    `public/llms.txt: ${(Buffer.byteLength(short) / 1024).toFixed(0)} KB (host retargeted)`,
);
