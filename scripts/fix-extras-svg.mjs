#!/usr/bin/env node
/**
 * 一次性数据修复：清掉 `data/tool-extras.json` 里被收割截断的 SVG `logo`/`icon`。
 *
 * 背景（2026-10-19 对抗式审查）：449 个工具的 logo/icon 里带着
 * `<path d="$58">` —— 收割时 SVG 路径数据被截断成了变量引用。它们经
 * `dangerouslySetInnerHTML` 注入后，浏览器每次渲染报
 * `Expected moveto path command ('M' or 'm'), "$58"`，且图标位置是空白。
 *
 * 为什么删字段值而不是删整个条目：这些字段只用于展示一个 16×16 小图标，
 * 值一旦残缺就毫无用处；删掉后渲染层走「没有 logo」的分支（纯文本），
 * 页面结构不变，也不再产生控制台报错。`label`/`text`/`href` 全部保留。
 *
 * 这是**一次性**脚本：抓取脚本本身已不再产出这种坏数据（新抓取没有这些
 * 字段），而 `scripts/check-extras.mjs` 会守住后续任何回归。
 *
 * 幂等：没有坏值时什么都不做，exit 0。
 *
 * Usage:
 *   node scripts/fix-extras-svg.mjs            # 报告将修多少条，不写
 *   node scripts/fix-extras-svg.mjs --write    # 实际写入
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'tool-extras.json');
const WRITE = process.argv.includes('--write');

/** 收割截断的指纹：`d="$58"` / `d='$57'`。 */
const BROKEN = /\sd\s*=\s*["']\s*\$[0-9]/;

const raw = readFileSync(SRC, 'utf8');
const extras = JSON.parse(raw);

let removedLogo = 0;
let removedIcon = 0;
const touched = [];

for (const [slug, entry] of Object.entries(extras)) {
  let changed = false;

  if (Array.isArray(entry.info)) {
    for (const row of entry.info) {
      if (typeof row.logo === 'string' && BROKEN.test(row.logo)) {
        delete row.logo;
        removedLogo++;
        changed = true;
      }
    }
  }

  if (Array.isArray(entry.platforms)) {
    for (const p of entry.platforms) {
      if (typeof p.icon === 'string' && BROKEN.test(p.icon)) {
        // `ToolPlatform.icon` 是必填字段，删掉会破坏类型；置空串让渲染层跳过。
        p.icon = '';
        removedIcon++;
        changed = true;
      }
    }
  }

  if (changed) touched.push(slug);
}

console.log(`受影响 slug：${touched.length}`);
console.log(`清除 logo：${removedLogo} 处；清空 icon：${removedIcon} 处`);

if (!touched.length) {
  console.log('没有需要修的坏 SVG，无需改动。');
  process.exit(0);
}

if (!WRITE) {
  console.log('\n（预览模式，未写入。加 --write 实际修改）');
  process.exit(0);
}

// 保持仓库既有的 **1 空格** 缩进与末尾换行。
//
// 这不是洁癖：`JSON.stringify` 默认会换一种缩进，于是 14 MB 文件整篇重排、
// diff 变成"整文件重写"，这次修复就没法 review 了。实测原文件是 1 空格
// （`JSON.stringify(…, null, 1)` 往返后逐字节一致），所以按 1 写回。
writeFileSync(SRC, `${JSON.stringify(extras, null, 1)}\n`, 'utf8');
console.log(`\n已写入 ${SRC}`);
