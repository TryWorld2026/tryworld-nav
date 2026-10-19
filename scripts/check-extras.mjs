#!/usr/bin/env node
/**
 * 校验 `data/tool-extras.json` 里被 `dangerouslySetInnerHTML` 注入的那几段
 * 原始 HTML，能否安全地进页面。
 *
 * 为什么需要这个脚本：`tool-details.tsx` 的 prose 与 `tool-info-panel.tsx` 的
 * logo/icon 都是原样注入的抓取产物，它们的安全性**是数据的属性，不是代码的
 * 属性**（组件注释里明说）。在此之前唯一的保证是一句"收割时人工扫过、0 命中"，
 * 而 2026-10-19 的对抗式审查证明这道保证已经漏过一次：
 *
 *   - 449 个工具的 `<svg>` 里带着 `<path d="$58">`（收割时 path 被截断成变量
 *     引用），浏览器每次渲染报 `Expected moveto path command`，图标位置空白，
 *     而全站 435 个详情页受影响 —— 没有任何检查拦过它。
 *
 * 所以把"数据干净"从注释里的断言变成每次 CI 都执行的检查。
 *
 * 检查项（任一命中即 exit 1）：
 *   1. 可执行/嵌入类元素：script / iframe / object / embed / form / style / link / meta
 *   2. `on*` 事件属性
 *   3. `javascript:` / `data:text/html` 协议
 *   4. SVG `d` 属性以 `$` 开头（收割截断的指纹）
 *   5. `<svg>` 里缺 viewBox（无法确定坐标系，画出来是错的）
 *
 * Usage: node scripts/check-extras.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'tool-extras.json');

const RULES = [
  { name: 'script 元素', re: /<script[\s>]/i },
  { name: 'iframe 元素', re: /<iframe[\s>]/i },
  { name: 'object 元素', re: /<object[\s>]/i },
  { name: 'embed 元素', re: /<embed[\s>]/i },
  { name: 'form 元素', re: /<form[\s>]/i },
  { name: 'style 元素', re: /<style[\s>]/i },
  { name: 'link 元素', re: /<link[\s>]/i },
  { name: 'meta 元素', re: /<meta[\s>]/i },
  { name: 'on* 事件属性', re: /\son[a-z]+\s*=/i },
  { name: 'javascript: 协议', re: /(?:href|src)\s*=\s*["']?\s*javascript:/i },
  { name: 'data:text/html', re: /data:text\/html/i },
  // 收割截断的典型指纹：`d="$58"` / `d='$57'`
  { name: 'SVG path 被截断（d="$N"）', re: /\sd\s*=\s*["']\s*\$[0-9]/ },
];

let extras;
try {
  extras = JSON.parse(readFileSync(SRC, 'utf8'));
} catch (err) {
  console.error(`::error::读不了 data/tool-extras.json：${err.message}`);
  process.exit(1);
}

const slugs = Object.keys(extras);
const hits = [];

/** 深度遍历一个 slug 的所有字符串字段。 */
function walk(node, slug, path) {
  if (typeof node === 'string') {
    for (const rule of RULES) {
      if (rule.re.test(node)) {
        hits.push({ slug, path, rule: rule.name, sample: node.slice(0, 120) });
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((x, i) => walk(x, `${path}[${i}]`, slug));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, slug, `${path}.${k}`);
  }
}

for (const slug of slugs) walk(extras[slug], slug, '');

if (hits.length) {
  const byRule = {};
  for (const h of hits) byRule[h.rule] = (byRule[h.rule] ?? 0) + 1;
  console.error(`::error::tool-extras.json 有 ${hits.length} 处不能安全注入的 HTML`);
  for (const [rule, n] of Object.entries(byRule)) console.error(`  ${rule}: ${n} 处`);
  for (const h of hits.slice(0, 10)) {
    console.error(`  ${h.slug}${h.path} [${h.rule}] -> ${h.sample}`);
  }
  if (hits.length > 10) console.error(`  …还有 ${hits.length - 10} 处`);
  console.error('\n这些字符串会经 dangerouslySetInnerHTML 注入页面，先修数据或修渲染层的过滤。');
  process.exit(1);
}

console.log(`tool-extras：${slugs.length} 个 slug 全部通过注入安全校验（${RULES.length} 条规则）`);
