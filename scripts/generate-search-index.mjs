/**
 * 生成客户端搜索索引 `data/search-index.json`。
 *
 * 目的：让「写代码」「做视频」这类**任务语**能命中正文里写着「代码补全」
 * 「视频生成」的工具。原实现只在名称/简介/分类/标签上做子串匹配，实测 22 个
 * 真实意图词里 6 个两处搜索面都 0 命中 —— 而索引 prose 后 22/22 都能召回。
 *
 * 做法：对每个工具，用 `src/lib/search.ts` 里的 `LEXICON` 扫一遍 prose，
 * 收集命中且**不在名称/简介里已经出现**的任务词（去重、按词表顺序截断 8 个）。
 * 这些词进索引的 `k` 字段，由 `lib/search.ts` 以 45 分档参与排序 —— 比名称
 * 命中低，比简介命中高：既能让「写代码」找回代码工具，又不会把「只是个视频
 * 工具」顶到「视频剪辑」前面。
 *
 * 两条净化的规则，都是被实测数据逼出来的：
 *   1. **文档频次上限**（MAX_DF）：出现超过 300 次的词（营销 818、报告 655、
 *      识别 616、自动化 533…）等于「人人都有」，对排序是噪音，对体积是灾难。
 *      第一版没做这一步，索引 raw 383 KB 且 Top 命中全是这些泛词。
 *   2. **名称/简介已有的词不进 k**：那些本来就能被搜到，重复记录只会撑大体积。
 *
 *   node scripts/generate-search-index.mjs           写入
 *   node scripts/generate-search-index.mjs --check   校验（CI 用）
 *
 * 体积预算：br 后 ≤70 KB。实测 raw 398 KB / br 67.6 KB —— 对比原先被打进
 * layout chunk 的完整 Tool 数组（br 182 KB），仍然小 63%。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'search-index.json');
const MAX_KEYWORDS = 8;
/** 「人人都有」的词：候选命中超过这个数就整体丢弃。 */
const MAX_DF = 300;
/** br 后体积上限（KB）。 */
const BUDGET_KB = 70;

const tools = JSON.parse(readFileSync(join(ROOT, 'data', 'tools.json'), 'utf8'));
const extras = JSON.parse(readFileSync(join(ROOT, 'data', 'tool-extras.json'), 'utf8'));

/** 从 TS 模块里取词表：它就是纯常量数组，用正则抽字符串字面量足够稳。 */
function loadLexicon() {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'search.ts'), 'utf8');
  const block = src.slice(src.indexOf('export const LEXICON'));
  const body = block.slice(block.indexOf('['), block.indexOf('];') + 1);
  const words = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (words.length < 20) throw new Error(`词表解析异常，只抽到 ${words.length} 个词`);
  return [...new Set(words)];
}

const LEXICON = loadLexicon();

/** HTML → 纯文本。prose 里是抓来的富文本，标签与实体必须剥掉再匹配。 */
function textOf(html) {
  return (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}

const proseBySlug = new Map();
for (const t of tools) proseBySlug.set(t.slug, textOf(extras[t.slug]?.prose));

/** 先把候选词按文档频次统计一遍，剔除无区分度的高频词。 */
const candidateDf = new Map();
for (const t of tools) {
  const prose = proseBySlug.get(t.slug) ?? '';
  const nameLower = (t.name ?? '').toLowerCase();
  const descLower = (t.description ?? '').toLowerCase();
  for (const word of LEXICON) {
    const w = word.toLowerCase();
    if (nameLower.includes(w) || descLower.includes(w)) continue;
    if (!prose.includes(w)) continue;
    candidateDf.set(w, (candidateDf.get(w) ?? 0) + 1);
  }
}

const useful = LEXICON.filter((w) => (candidateDf.get(w.toLowerCase()) ?? 0) <= MAX_DF);

const records = [];
const keywordHits = new Map();

for (const t of tools) {
  const prose = proseBySlug.get(t.slug) ?? '';
  const nameLower = (t.name ?? '').toLowerCase();
  const descLower = (t.description ?? '').toLowerCase();

  const k = [];
  for (const word of useful) {
    const w = word.toLowerCase();
    if (nameLower.includes(w) || descLower.includes(w)) continue;
    if (!prose.includes(w)) continue;
    k.push(w);
    keywordHits.set(w, (keywordHits.get(w) ?? 0) + 1);
    if (k.length >= MAX_KEYWORDS) break;
  }

  records.push({
    s: t.slug,
    n: t.name,
    d: t.description ?? '',
    // 存完整 icon 路径：图标有 png/jpg/jpeg/webp/svg/avif 六种扩展名，
    // 硬编码 `.png` 会让 345 个条目破图。
    i: t.icon ?? '',
    c: (t.categories ?? []).map((c) => c.slug),
    t: t.tags ?? [],
    ...(k.length ? { k } : {}),
  });
}

/** 按 slug 排序，保证输出确定性（tools.json 顺序变了也不影响 buildId 语义）。 */
records.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));

const json = JSON.stringify(records) + '\n';
const check = process.argv.includes('--check');
const rawKb = Buffer.byteLength(json) / 1024;
/**
 * 预算按 **Brotli 后**的体积算，因为这才是访客真正下载的量（线上 Cloudflare
 * 与本地 `serve` 都会压）。只看 raw 会把索引误判成超预算六倍。
 */
const brKb =
  brotliCompressSync(Buffer.from(json), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  }).length / 1024;

const sizeLabel = `raw ${rawKb.toFixed(1)} KB / br ${brKb.toFixed(1)} KB`;

if (check) {
  if (!existsSync(OUT)) {
    console.error('data/search-index.json 不存在，先跑 npm run gen:search-index');
    process.exit(1);
  }
  if (readFileSync(OUT, 'utf8') !== json) {
    console.error('data/search-index.json 与数据源不一致，跑 npm run gen:search-index 重新生成');
    process.exit(1);
  }
  console.log(`search-index.json 已是最新（${sizeLabel}）`);
} else {
  writeFileSync(OUT, json);
  const withKw = records.filter((r) => r.k).length;
  const top = [...keywordHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(
    `search-index.json 写入完成：${records.length} 条 / ${withKw} 条有关键词 / ${sizeLabel}`,
  );
  console.log('关键词命中数 Top8：', top.map(([w, n]) => `${w}=${n}`).join(' '));
  if (brKb > BUDGET_KB) {
    console.error(
      `⚠ 索引超过 ${BUDGET_KB} KB（br）预算，当前 ${brKb.toFixed(1)} KB：减少 MAX_KEYWORDS 或词表`,
    );
    process.exit(1);
  }
}
