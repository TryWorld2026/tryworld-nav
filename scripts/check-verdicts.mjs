/**
 * 校验 `src/lib/tool-verdicts.ts` 里的判断数据。
 *
 * 这些是**事实性主张**（缺点、对比、起价），写错比不写更伤信任，所以进 CI：
 *   - slug 必须真的在目录里（否则那一页永远不显示，等于白写）；
 *   - `bestFor` 至少 1 条、每条不超过 40 字（超过就不是「场景」而是段落）；
 *   - `notFor` 若存在，不许为空数组（空数组说明作者想占位，占位就会渲染出空标题）；
 *   - `diff` 不超过 80 字，且 `vs` 若给出必须是存在的 slug；
 *   - `price.checkedAt` 必须是 `YYYY-MM-DD`，且不能是未来日期（抄错年份很常见）；
 *   - `confidence` 只能是 editor / sourced。
 *
 *   node scripts/check-verdicts.mjs   有错 exit 1
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 直接从 TS 源码里提取对象字面量。
 *
 * 为什么不用 import：Node 解析 `.ts` 时相对 import 必须带扩展名，而这份文件
 * 里 import 了 `./types` 这类无扩展路径（Next 习惯），`node scripts/…` 直接
 * import 会失败。这里用正则 + `JSON.parse` 的宽松替代（Function 求值）读取，
 * 代价是这个脚本只读、不参与构建，风险可控。
 */
function loadVerdicts() {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'tool-verdicts.ts'), 'utf8');
  const marker = 'export const VERDICTS: Record<string, ToolVerdict> =';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('找不到 VERDICTS 定义');
  const bodyStart = src.indexOf('{', start);
  // 括号配平（跳过字符串里的花括号）
  let depth = 0;
  let inStr = null;
  let end = -1;
  for (let i = bodyStart; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error('VERDICTS 花括号不配平');
  const literal = src.slice(bodyStart, end);
  // 该字面量是合法 JS（键用单引号），用 Function 求值最省事。
  return new Function(`return (${literal});`)();
}

const tools = JSON.parse(readFileSync(join(ROOT, 'data', 'tools.json'), 'utf8'));
const slugs = new Set(tools.map((t) => t.slug));
const verdicts = loadVerdicts();

const errors = [];
const warnings = [];
const today = new Date().toISOString().slice(0, 10);

const checkText = (slug, field, value, max) => {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${slug}.${field} 必须是非空字符串`);
    return;
  }
  if (value.length > max) {
    errors.push(`${slug}.${field} 太长（${value.length} > ${max} 字）：${value.slice(0, 30)}…`);
  }
};

for (const [slug, v] of Object.entries(verdicts)) {
  if (!slugs.has(slug)) {
    errors.push(`${slug} 不在 data/tools.json 里（这一页永远不会显示这条判断）`);
    continue;
  }
  if (!v || typeof v !== 'object') {
    errors.push(`${slug} 的值不是对象`);
    continue;
  }

  if (!Array.isArray(v.bestFor) || v.bestFor.length === 0) {
    errors.push(`${slug}.bestFor 必须是至少 1 条的数组`);
  } else {
    if (v.bestFor.length > 4) warnings.push(`${slug}.bestFor 有 ${v.bestFor.length} 条（建议 ≤4）`);
    v.bestFor.forEach((s, i) => checkText(slug, `bestFor[${i}]`, s, 40));
  }

  if (v.notFor !== undefined) {
    if (!Array.isArray(v.notFor) || v.notFor.length === 0) {
      errors.push(`${slug}.notFor 若写了就必须至少 1 条（空数组会渲染出空标题）`);
    } else {
      if (v.notFor.length > 3) warnings.push(`${slug}.notFor 有 ${v.notFor.length} 条（建议 ≤3）`);
      v.notFor.forEach((s, i) => checkText(slug, `notFor[${i}]`, s, 40));
    }
  }

  if (v.diff !== undefined) checkText(slug, 'diff', v.diff, 80);

  if (v.vs !== undefined) {
    if (!slugs.has(v.vs)) errors.push(`${slug}.vs 指向不存在的工具：${v.vs}`);
    if (!v.diff) warnings.push(`${slug} 有 vs 但没有 diff，对比会没有上下文`);
  }

  if (v.price !== undefined) {
    const p = v.price;
    if (p.checkedAt === undefined) {
      errors.push(`${slug}.price.checkedAt 必填（价格没有核对日期等于没有价格）`);
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.checkedAt))) {
      errors.push(`${slug}.price.checkedAt 不是 YYYY-MM-DD：${p.checkedAt}`);
    } else if (String(p.checkedAt) > today) {
      errors.push(`${slug}.price.checkedAt 是未来日期：${p.checkedAt}（今天 ${today}）`);
    }
    if (p.from !== undefined && (typeof p.from !== 'number' || p.from < 0)) {
      errors.push(`${slug}.price.from 必须是非负数字`);
    }
    if (p.currency !== undefined && !['CNY', 'USD'].includes(p.currency)) {
      errors.push(`${slug}.price.currency 只能是 CNY / USD：${p.currency}`);
    }
    if (p.period !== undefined && !['月', '年', '次'].includes(p.period)) {
      errors.push(`${slug}.price.period 只能是 月 / 年 / 次：${p.period}`);
    }
    if (p.from === undefined && !p.freeTier) {
      warnings.push(`${slug}.price 既没有起价也没有免费额度描述，渲染出来只有一行日期`);
    }
  }

  if (!['editor', 'sourced'].includes(v.confidence)) {
    errors.push(`${slug}.confidence 只能是 editor / sourced：${v.confidence}`);
  }
}

const count = Object.keys(verdicts).length;
console.log(`verdicts：${count} 条 / 目录 ${slugs.size} 个工具（覆盖 ${((count / slugs.size) * 100).toFixed(1)}%）`);

if (warnings.length) {
  console.log('\n提醒：');
  for (const w of warnings) console.log('  · ' + w);
}

if (errors.length) {
  console.error('\n错误：');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log('\n全部通过。');
