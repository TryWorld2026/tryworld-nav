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
 * 体积预算：br 后 ≤70 KB（写入与 `--check` **两条路径都断言**，否则超预算的
 * 索引能在本地无声写出，只在 CI 的 --check 里才炸）。
 *
 * v2 的紧凑 wire format（2026-10-22）：目录页不再序列化 2081 个完整 Tool，
 * 而是把这一份索引下发给客户端，由 `decodeSearchIndex()` 水化成 `SearchRecord`。
 * 为了让 2081 条同时带上「价格 / 平台 / 更新时间 / 有无官网」四类筛选事实，
 * 重复的字符串全部换成共享字典的整数 ID：
 *
 *   { v:2, cats:[…], tags:[…], kw:[…], pl:[…],
 *     rows:[ [slug, name, desc, iconExt, [catId…], [tagId…], [kwId…],
 *              priceCode, platformMask, unixDay?, hasExternal?] ] }
 *
 * row 的槽位是固定的（见 `src/lib/search.ts` 的解码器）：
 *   0 s / 1 n / 2 d / 3 icon 扩展名字母 / 4 c / 5 t / 6 k（无则 `[]`）/
 *   7 p（0–4）/ 8 pl（bitmask）/ 9 u（Unix 日序）/ 10 w（仅 true 时写 1）。
 *   只有尾部的 9、10 允许省略，且 10 依附于 9 —— 全量数据里只有 `pokecut`
 *   同时缺 updated 与 external，正好落在最后两槽。
 *
 * icon 只存一个扩展字母：实测 2081 条的 icon 全部严格等于
 * `/assets/icons/{slug}.{png|jpg|jpeg|svg|webp|avif}`，水化时按 slug 复原完整
 * 路径即可（省 2081 × ~35 字节）。**必须复原成完整 `/assets/…` 路径**：
 * `NEXT_PUBLIC_ASSET_BASE` 是渲染时由 `lib/assets.ts` 前缀的，索引里不能预先拼。
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

/** 采集到的价格中文标签 → wire 里的 0–4 价格码（与 lib/search.ts 的 PRICE_CODES 同序）。 */
const PRICE_CODES = ['fully-free', 'open-source', 'freemium', 'paid', 'unrated'];
const LABEL_TO_CODE = {
  免费: 0,
  免费开源: 1,
  免费增值: 2,
  付费: 3,
};
/** icon 扩展名 → 单字母（水印式编码，见文件头）。 */
const ICON_EXT = { png: 'p', jpg: 'j', svg: 's', jpeg: 'e', webp: 'w', avif: 'v' };

const tools = JSON.parse(readFileSync(join(ROOT, 'data', 'tools.json'), 'utf8'));
const extras = JSON.parse(readFileSync(join(ROOT, 'data', 'tool-extras.json'), 'utf8'));

/**
 * 从 TS 模块里取词表：它就是纯常量数组，用正则抽字符串字面量足够稳。
 *
 * 锚点必须精确到**声明本身**（`export const LEXICON: string[] = [`），不能只
 * 搜 `export const LEXICON`：`INTENTS` 的文档注释里也写着 "`LEXICON`" 这个词，
 * 于是 slice 会从注释开始，把整个 `INTENTS` 数组的键与别名（`画图`、`做播客`、
 * `电子邮件`…）一并当成词表成分 —— 这些词文档频次都不到 MAX_DF=300，会被
 * 判为"有区分度"，挤进每个工具的关键词列表，索引因此超预算。
 *
 * 2026-10-19 复现：加了几条口语意图后索引从 69.8 KB 涨到 71.2 KB 并触发
 * generate 脚本的 70 KB 硬预算 exit 1，根因就是这里抽错了区间。
 */
function loadLexicon() {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'search.ts'), 'utf8');
  const decl = src.search(/export const LEXICON\s*:\s*string\[\]\s*=/);
  if (decl < 0) throw new Error('找不到 `export const LEXICON: string[] =` 声明');
  const block = src.slice(decl);
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

const keywordHits = new Map();

/**
 * 平台字典按**出现频次降序**建立（Web=iOS…）。频次高的名字落在低位，
 * bitmask 里小整数出现得最多，JSON 也更短。同频时按名称字典序，保证输出
 * 与遍历顺序无关（确定性是 `--check` 的前提）。
 */
const platformFreq = new Map();
for (const t of tools) {
  for (const p of extras[t.slug]?.platforms ?? []) {
    const name = typeof p?.name === 'string' ? p.name.trim() : '';
    if (!name) continue;
    platformFreq.set(name, (platformFreq.get(name) ?? 0) + 1);
  }
}
const PLATFORMS = [...platformFreq.entries()]
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .map(([name]) => name);
// bitmask 只有 16 位可安全放进一个 JSON 小整数；再多就要换编码方案，宁可现在炸。
if (PLATFORMS.length > 16) {
  throw new Error(`平台名超过 16 个（${PLATFORMS.length}），bitmask 编码不再适用`);
}
const platformBit = new Map(PLATFORMS.map((name, i) => [name, i]));

/** extras 里的 `updated` 是 `'2026-08-22 06:17:19.986Z'`（空格代替 T），先修成 ISO 再取日序。 */
function unixDayOf(slug) {
  const raw = extras[slug]?.updated;
  if (typeof raw !== 'string' || !raw) return undefined;
  const ms = Date.parse(raw.replace(' ', 'T'));
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 86_400_000);
}

function priceCodeOf(slug) {
  const label = extras[slug]?.pricing;
  return typeof label === 'string' && label in LABEL_TO_CODE
    ? LABEL_TO_CODE[label]
    : PRICE_CODES.length - 1; // absent / 未知 / 未识别 → unrated
}

const catDict = [...new Set(tools.flatMap((t) => (t.categories ?? []).map((c) => c.slug)))];
const catId = new Map(catDict.map((slug, i) => [slug, i]));
const tagDict = [...new Set(tools.flatMap((t) => t.tags ?? []))];
const tagId = new Map(tagDict.map((name, i) => [name, i]));

const kwDict = new Map();
const rows = [];
const missingIcon = [];

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
  for (const w of k) if (!kwDict.has(w)) kwDict.set(w, kwDict.size);

  const icon = t.icon ?? '';
  const ext = ICON_EXT[icon.slice(icon.lastIndexOf('.') + 1)];
  if (!ext || !icon.startsWith('/assets/icons/')) missingIcon.push(icon || t.slug);

  let mask = 0;
  for (const p of extras[t.slug]?.platforms ?? []) {
    const bit = platformBit.get(typeof p?.name === 'string' ? p.name.trim() : '');
    if (bit !== undefined) mask |= 1 << bit;
  }

  const row = [
    t.slug,
    t.name,
    t.description ?? '',
    ext ?? 'p',
    (t.categories ?? []).map((c) => catId.get(c.slug)),
    (t.tags ?? []).map((g) => tagId.get(g)),
    k.map((w) => kwDict.get(w)),
    priceCodeOf(t.slug),
    mask,
  ];
  const u = unixDayOf(t.slug);
  const w = typeof extras[t.slug]?.external === 'string' && extras[t.slug].external ? 1 : 0;
  // 尾部可选槽：只有 u 已知才写第 9 槽；只有 w 为真（此时 u 必然也在）才写第 10 槽。
  if (u !== undefined) {
    row.push(u);
    if (w) row.push(1);
  }
  rows.push(row);
}

if (missingIcon.length) {
  throw new Error(
    `icon 路径不再符合 /assets/icons/{slug}.{六种扩展名}，wire 编码需重设计：${missingIcon.slice(0, 5).join(' ')}`,
  );
}

/**
 * rows 保持 `tools.json` 的原始顺序 —— 这就是「无 `q` 时按目录顺序浏览」的
 * 依据，水化时把它写回 `o`。旧版按 slug 排序会静默改掉默认浏览顺序，
 * 目录第 1 页从此不再是原站的手调排序。
 */
const wire = {
  v: 2,
  cats: catDict,
  tags: tagDict,
  kw: [...kwDict.keys()],
  pl: PLATFORMS,
  rows,
};

const json = JSON.stringify(wire) + '\n';
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

/** 写入和校验都必须守预算：见文件头。 */
if (brKb > BUDGET_KB) {
  console.error(
    `⚠ 索引超过 ${BUDGET_KB} KB（br）预算，当前 ${brKb.toFixed(1)} KB：减少 MAX_KEYWORDS 或词表`,
  );
  process.exit(1);
}

if (check) {
  if (!existsSync(OUT)) {
    console.error('data/search-index.json 不存在，先跑 npm run gen:search-index');
    process.exit(1);
  }
  if (readFileSync(OUT, 'utf8') !== json) {
    console.error('data/search-index.json 与数据源不一致，跑 npm run gen:search-index 重新生成');
    process.exit(1);
  }
  console.log(`search-index.json 已是最新（v2，${rows.length} 条 / ${sizeLabel}）`);
} else {
  writeFileSync(OUT, json);
  const withKw = rows.filter((r) => r[6].length).length;
  const top = [...keywordHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(
    `search-index.json 写入完成：v2 ${rows.length} 条 / ${withKw} 条有关键词 / ${sizeLabel}`,
  );
  console.log('关键词命中数 Top8：', top.map(([w, n]) => `${w}=${n}`).join(' '));
}
