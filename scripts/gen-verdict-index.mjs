/**
 * 生成客户端判断数据 `data/verdict-index.json`。
 *
 * 背景：`src/lib/tool-verdicts.ts` 里 363 条人工判断是**服务端**模块（它是
 * `src/lib/` 下的 TS 常量，约 3000 行）。`/decide`（帮我选）与 `/favorites`
 * （我的工具栈）都要在浏览器里读它 —— 但客户端组件不能 import 它，否则
 * 每页都要背一份 TS 源码；也不该 import `@/lib/data`（14 MB 正文）。
 *
 * 这里把「判断」与「卡片需要的事实」合成一份**只含 363 条**的紧凑数据：
 * 名称 / 图标 / 分类 / 标签 / 价格档 / 平台 / 更新时间 + 判断正文。
 * 每小时后的 JSON 约 150–200 KB（br 后约 50 KB），只有 /decide 与 /favorites
 * 两条路由会加载它。
 *
 *   node scripts/gen-verdict-index.mjs          写入 data/verdict-index.json
 *   node scripts/gen-verdict-index.mjs --check  只校验是否最新（CI 用）
 *
 * 确定性要求（与 generate-nav.mjs 同）：输出必须逐字节可复现 ——
 * `generatedAt` 取**条目里最大的 checkedAt**，不读墙钟；键顺序写死；
 * 否则 `contentBuildId()` 天天变，增量部署失效。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'verdict-index.json');

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const { VERDICTS } = await import(
  new URL('../src/lib/tool-verdicts.ts', import.meta.url).href
);
const { decodeSearchIndex } = await import(
  new URL('../src/lib/search.ts', import.meta.url).href
);

const records = decodeSearchIndex(read('data/search-index.json'));
const bySlug = new Map(records.map((r) => [r.s, r]));

/** 条目按 `VERDICTS` 的书写顺序（分类分组、组内按被比较频次），不重排。 */
const items = {};
const missing = [];
let maxChecked = '';

for (const [slug, v] of Object.entries(VERDICTS)) {
  const rec = bySlug.get(slug);
  if (!rec) {
    missing.push(slug);
    continue;
  }
  const price = v.price;
  if (price?.checkedAt && price.checkedAt > maxChecked) maxChecked = price.checkedAt;

  const entry = {
    name: rec.n,
    icon: rec.i,
    cats: rec.c,
    tags: rec.t,
    price: rec.p,
    platforms: rec.pl,
    bestFor: v.bestFor,
    notFor: v.notFor ?? [],
    confidence: v.confidence,
    /** 目录序号 —— 「在同类里排第几」的唯一客观依据（`tools.json` 的原始顺序）。 */
    order: rec.o,
  };
  if (typeof rec.u === 'number') entry.updated = rec.u;
  if (v.diff) entry.diff = v.diff;
  if (v.vs) entry.vs = anonVs(v.vs, slug, bySlug, missing);
  if (price) {
    const p = {};
    if (price.freeTier) p.free = price.freeTier;
    if (typeof price.from === 'number') p.from = price.from;
    if (price.currency) p.currency = price.currency;
    if (price.period) p.period = price.period;
    p.checkedAt = price.checkedAt;
    entry.verdictPrice = p;
  }
  items[slug] = entry;
}

/** `vs` 指向的工具可能不在目录里（判断写于收录变化之前）—— 失效就丢掉，不留悬空链接。 */
function anonVs(vs, self, index, bucket) {
  if (!vs || vs === self) return undefined;
  if (!index.has(vs)) {
    bucket.push(`vs-target:${self}->${vs}`);
    return undefined;
  }
  return vs;
}

if (missing.length) {
  console.error('以下判断条目的 slug 不在目录里：', missing.join(', '));
  process.exit(1);
}

const payload = {
  v: 1,
  generatedAt: maxChecked || '',
  source: 'src/lib/tool-verdicts.ts',
  count: Object.keys(items).length,
  items,
};

const json = JSON.stringify(payload) + '\n';
const check = process.argv.includes('--check');

if (check) {
  if (!existsSync(OUT)) {
    console.error('data/verdict-index.json 不存在，先跑 npm run gen:verdicts');
    process.exit(1);
  }
  if (readFileSync(OUT, 'utf8') !== json) {
    console.error('data/verdict-index.json 与 tool-verdicts.ts 不一致，跑 npm run gen:verdicts');
    process.exit(1);
  }
  console.log('verdict-index.json 已是最新');
} else {
  writeFileSync(OUT, json);
  const kb = (Buffer.byteLength(json) / 1024).toFixed(1);
  console.log(`verdict-index.json 写入完成：${payload.count} 条判断，${kb} KB`);
}
