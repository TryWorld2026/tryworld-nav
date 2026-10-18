/**
 * 从 prose 里抽取「价格 / 适用场景」候选，生成人工审阅用的草稿。
 *
 * ⚠️ **这个脚本绝不写 data/ 或 src/**。它的唯一产物是 `work/verdict-drafts.md`，
 * 供编辑逐条核对后手工写进 `src/lib/tool-verdicts.ts`。
 *
 * 为什么必须人工：判断数据里有「不适合谁」「与同类差异」「起价」这类事实性
 * 主张。写错一个价格，比不写更伤信任 —— 而这个站的定位是导航，不是评测。
 * 审计里 83.47% 的价格徽章都是同一个词「免费增值」，真正写了具体价格的正文
 * 只有 43.97%，所以草稿只能给出「这一段原文在此」的线索，不能自动成稿。
 *
 *   node scripts/draft-verdicts.mjs              全部 2081 条（慢，输出大）
 *   node scripts/draft-verdicts.mjs --limit 200  只取前 200 条（推荐）
 *   node scripts/draft-verdicts.mjs --slugs a,b  指定 slug
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'work');
const OUT = join(OUT_DIR, 'verdict-drafts.md');

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) || 200 : 0;
const slugsArg = args.indexOf('--slugs');
const ONLY = slugsArg >= 0 ? (args[slugsArg + 1] ?? '').split(',').filter(Boolean) : null;

const tools = JSON.parse(readFileSync(join(ROOT, 'data', 'tools.json'), 'utf8'));
const extras = JSON.parse(readFileSync(join(ROOT, 'data', 'tool-extras.json'), 'utf8'));
const homeRails = JSON.parse(readFileSync(join(ROOT, 'data', 'home-rails.json'), 'utf8'));
const categoryOrder = JSON.parse(readFileSync(join(ROOT, 'data', 'category-order.json'), 'utf8'));

/** HTML → 段落数组（保留小节标题，方便定位「产品价格」段）。 */
function sections(html) {
  const text = (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<h2[^>]*>/gi, '\n## ')
    .replace(/<\/h2>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t) out.push(t);
  }
  return out;
}

/** 从段落里找「产品价格」小节的内容。 */
function priceSection(parts) {
  const idx = parts.findIndex((p) => /^##\s*(产品价格|价格|定价|收费)/.test(p));
  if (idx < 0) return '';
  // 取该标题后的 1–2 段，切到下一个 ## 为止
  const buf = [];
  for (let i = idx + 1; i < parts.length && buf.length < 2; i++) {
    if (parts[i].startsWith('## ')) break;
    buf.push(parts[i]);
  }
  return buf.join(' ').slice(0, 300);
}

/** 从段落里找「应用场景」小节。 */
function scenarioSection(parts) {
  const idx = parts.findIndex((p) => /^##\s*(应用场景|使用场景|适用场景)/.test(p));
  if (idx < 0) return '';
  const buf = [];
  for (let i = idx + 1; i < parts.length && buf.length < 2; i++) {
    if (parts[i].startsWith('## ')) break;
    buf.push(parts[i]);
  }
  return buf.join(' ').slice(0, 240);
}

/** 优先级：首页推荐 > 各分类手工排序前 3 > 其余。 */
const priority = new Map();
homeRails.hot?.forEach((s, i) => priority.set(s, `热门 ${i + 1}`));
homeRails.newest?.forEach((s) => {
  if (!priority.has(s)) priority.set(s, '最新收录');
});
for (const [cat, list] of Object.entries(categoryOrder)) {
  (list ?? []).slice(0, 3).forEach((s, i) => {
    if (!priority.has(s)) priority.set(s, `${cat} 第${i + 1}`);
  });
}

let list = tools;
if (ONLY) list = list.filter((t) => ONLY.includes(t.slug));
// 有优先级标记的排前面，其余按目录序
list = list.slice().sort((a, b) => {
  const pa = priority.has(a.slug) ? 0 : 1;
  const pb = priority.has(b.slug) ? 0 : 1;
  return pa - pb;
});
if (LIMIT > 0) list = list.slice(0, LIMIT);

const lines = [
  '# verdict-drafts · 「怎么选」候选草稿',
  '',
  '> 由 `scripts/draft-verdicts.mjs` 生成，**仅供人工审阅**。',
  '> 核对后请手工写进 `src/lib/tool-verdicts.ts`（不要直接改这个文件，下次会覆盖）。',
  '',
  `共 ${list.length} 条。`,
  '',
];

let withPrice = 0;
for (const t of list) {
  const e = extras[t.slug];
  const parts = sections(e?.prose);
  const price = priceSection(parts);
  const scenario = scenarioSection(parts);
  if (price) withPrice += 1;

  lines.push(`## ${t.name} (\`${t.slug}\`)`);
  lines.push('');
  lines.push(`- 分类：${(t.categories ?? []).map((c) => c.name).join(' / ') || '—'}`);
  lines.push(`- 简介：${t.description}`);
  lines.push(`- 徽章价格：${e?.pricing ?? '（无）'}${e?.updated ? ` ｜ 更新：${e.updated.slice(0, 10)}` : ''}`);
  if (price) lines.push(`- 正文价格段：${price}`);
  if (scenario) lines.push(`- 正文场景段：${scenario}`);
  if (priority.has(t.slug)) lines.push(`- 优先级：${priority.get(t.slug)}`);
  lines.push('');
}

lines.push(`---`);
lines.push('');
lines.push(`有正文价格段的条目：**${withPrice} / ${list.length}**（其余只能靠人工核对官网）。`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, lines.join('\n'));
console.log(
  `verdict 草稿写入 ${OUT}\n条目 ${list.length} 条，其中有正文价格段 ${withPrice} 条。\n` +
    `下一步：人工核对后写进 src/lib/tool-verdicts.ts，再跑 node scripts/check-verdicts.mjs`,
);
