/**
 * 「我的工具栈」导出与对比的回归（纯函数级）。
 *
 * 守四件事：
 *   1. **导出格式**。Markdown 是这一页唯一能被「带走」的东西 —— 标题、来源行、
 *      分类分组、每条一个链接，格式坏了用户是拿着它去贴笔记的。
 *   2. **空分类 / 无价格 / 无判断**。这三种情况在真实收藏里非常常见
 *      （v1 迁移来的条目连名称都是 slug），不能导出空行、`—` 或者编造的句子。
 *   3. **v1 老收藏仍能导出**。`parseStore('["lovart-ai"]')` 出来只有 slug，
 *      水化时必须靠目录事实补全名称，否则导出的是一串英文 slug。
 *   4. **对比表行序稳定**。换了对比对象，眼睛还要在同一行找到「价格档」。
 *
 *   node --test tests/stack-export.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DASH,
  LIST_SEP,
  NO_NOT_FOR,
  NO_VERDICT,
  STACK_COMPARE_ROWS,
  UNCATEGORIZED,
  buildStackCompareRows,
  buildStackMarkdown,
  buildStackPlainText,
  countStale,
  hasVerdict,
  stackFileName,
  toStackTool,
} from '../src/lib/stack-export.ts';
import { parseStore } from '../src/lib/favorites.ts';

/** @type {import('../src/lib/stack-export.ts').StackTool} */
const KLING = {
  slug: 'kling',
  name: '可灵 AI',
  category: 'AI视频/动画',
  price: '免费增值',
  freeQuota: '每月赠送额度',
  fromPrice: '¥66 / 月',
  platforms: ['Web'],
  updated: '2025 年 8 月更新',
  bestFor: ['中文语义镜头控制', '短视频出片'],
  notFor: ['需要逐帧精修的广告片'],
  diff: '与 Runway 相比强在中文字幕口型，弱在镜头模板数量。',
  url: 'https://nav.tryworld.com.cn/tools/kling',
  stale: false,
};

const META = { date: '2026-10-23' };

test('Markdown 结构与示例逐字一致', () => {
  const md = buildStackMarkdown([KLING], META);
  assert.equal(
    md,
    [
      '# 我的 AI 工具栈',
      '> 来自试界导航 · 2026-10-23 · 共 1 个工具',
      '',
      '## AI视频/动画',
      '- **可灵 AI** — 免费增值 · Web · 2025 年 8 月更新',
      '  适合：中文语义镜头控制 / 短视频出片',
      '  不适合：需要逐帧精修的广告片',
      '  与同类差异：与 Runway 相比强在中文字幕口型，弱在镜头模板数量。',
      '  https://nav.tryworld.com.cn/tools/kling',
      '',
    ].join('\n'),
  );
});

test('空分类归入「未分类」，且不会出现空的 ## 标题', () => {
  const md = buildStackMarkdown([{ ...KLING, category: '' }], META);
  assert.ok(md.includes(`## ${UNCATEGORIZED}`), '应有一个「未分类」分组');
  assert.ok(!/^##\s*$/m.test(md), '不应出现空的分类标题');
  assert.equal(UNCATEGORIZED, '未分类');
});

test('无价格 / 无平台 / 无更新时间：事实段整体省略，不留孤零零的破折号', () => {
  const bare = { ...KLING, price: '', platforms: [], updated: '' };
  const md = buildStackMarkdown([bare], META);
  assert.ok(md.includes('- **可灵 AI**\n'), '名称后不应跟「 — 」空事实');
  assert.ok(!md.includes(' — \n'), '不应留下空的破折号段');
  assert.ok(!md.includes('··'), '不应拼出连续的分隔符');
});

test('无判断：Markdown 不写空的「适合：」行，对比表写「未写判断」', () => {
  const noVerdict = { ...KLING, bestFor: [], notFor: [], diff: '', freeQuota: '', fromPrice: '' };
  const md = buildStackMarkdown([noVerdict], META);
  assert.ok(!md.includes('适合：'), '没写判断就不应出现「适合：」这一行');
  assert.ok(!md.includes('不适合：'), '没写判断就不应出现「不适合：」这一行');

  const rows = buildStackCompareRows([noVerdict]);
  assert.equal(rows.find((r) => r.key === 'bestFor').cells[0], NO_VERDICT);
  assert.equal(rows.find((r) => r.key === 'notFor').cells[0], NO_VERDICT);
  assert.equal(rows.find((r) => r.key === 'diff').cells[0], NO_VERDICT);
  // 事实行仍然有值 —— 「没写判断」不等于「没有事实」。
  assert.equal(rows.find((r) => r.key === 'price').cells[0], '免费增值');
});

test('有判断但没写「不适合」：单元格说「判断里未写不适合」，而不是「未写判断」', () => {
  const rows = buildStackCompareRows([{ ...KLING, notFor: [] }]);
  assert.equal(rows.find((r) => r.key === 'notFor').cells[0], NO_NOT_FOR);
  assert.equal(hasVerdict({ bestFor: ['x'] }), true);
  assert.equal(hasVerdict({}), false);
});

test('缺采集数据的事实行用 —，不推测也不写「未知」', () => {
  const rows = buildStackCompareRows([{ ...KLING, price: '', platforms: [], updated: '', category: '' }]);
  for (const key of ['price', 'platforms', 'updated', 'category']) {
    assert.equal(rows.find((r) => r.key === key).cells[0], DASH, `${key} 缺数据时应为 ${DASH}`);
  }
});

test('对比表：九行固定顺序，cells 与工具一一对应，同一输入输出稳定', () => {
  const tools = [KLING, { ...KLING, slug: 'runway', name: 'Runway', category: 'AI视频/动画' }];
  const a = buildStackCompareRows(tools);
  const b = buildStackCompareRows(tools);

  assert.deepEqual(
    a.map((r) => r.key),
    STACK_COMPARE_ROWS.map((r) => r.key),
    '行序必须等于常量顺序',
  );
  assert.equal(a.length, 9);
  for (const row of a) {
    assert.equal(row.cells.length, tools.length, `${row.label} 的单元格数应等于工具数`);
  }
  assert.deepEqual(a, b, '同一输入必须得到同一结果');

  // 多值单元格用 LIST_SEP 连接，UI 依赖它拆回多行。
  assert.equal(a.find((r) => r.key === 'bestFor').cells[0], KLING.bestFor.join(LIST_SEP));
  assert.equal(LIST_SEP, ' / ');
});

test('v1 老收藏（只有 slug）能水化并导出，不导出裸 slug', () => {
  const migrated = parseStore('["lovart-ai"]');
  assert.equal(migrated.items.length, 1);
  const item = migrated.items[0];
  assert.equal(item.name, 'lovart-ai', '迁移后的兜底名称就是 slug');

  const tool = toStackTool({
    slug: item.slug,
    stored: item,
    catalog: {
      name: 'Lovart',
      price: '免费增值',
      platforms: ['Web'],
      categoryName: 'AI图像/设计',
      updated: '2025 年 9 月更新',
    },
    verdict: null,
    url: 'https://nav.tryworld.com.cn/tools/lovart-ai',
    stale: false,
  });

  assert.equal(tool.name, 'Lovart', '目录有名称时以目录为准');
  const md = buildStackMarkdown([tool], META);
  assert.ok(md.includes('- **Lovart** —'), '导出的应是目录里的名称');
  assert.ok(!md.includes('**lovart-ai**'), '不应把 slug 当名称导出');
});

test('目录里查不到的工具：回退收藏快照的名称，仍能呈现与导出', () => {
  const tool = toStackTool({
    slug: 'ghost-tool',
    stored: { name: '已下架的工具' },
    catalog: null,
    verdict: null,
    url: 'https://nav.tryworld.com.cn/tools/ghost-tool',
    stale: false,
  });
  assert.equal(tool.name, '已下架的工具');
  assert.equal(tool.category, '');
  const md = buildStackMarkdown([tool], META);
  assert.ok(md.includes(`## ${UNCATEGORIZED}`));
  assert.ok(md.includes('- **已下架的工具**'));
  // 名称也没有的极端情况：用 slug，至少不是空白
  assert.equal(
    toStackTool({ slug: 'x', stored: { name: '' }, url: 'u', stale: false }).name,
    'x',
  );
});

test('纯文本导出：没有 Markdown 标记，分类用【】', () => {
  const txt = buildStackPlainText([KLING], META);
  assert.ok(!txt.includes('**'), '纯文本不应出现加粗标记');
  assert.ok(!txt.includes('##'), '纯文本不应出现 Markdown 标题');
  assert.ok(txt.includes('【AI视频/动画】'));
  assert.ok(txt.includes('可灵 AI — 免费增值 · Web · 2025 年 8 月更新'));
  assert.ok(txt.includes('https://nav.tryworld.com.cn/tools/kling'));
});

test('空栈导出只有标题与 0 条，不抛错', () => {
  const md = buildStackMarkdown([], META);
  assert.equal(md, '# 我的 AI 工具栈\n> 来自试界导航 · 2026-10-23 · 共 0 个工具\n');
  assert.deepEqual(buildStackCompareRows([]).map((r) => r.cells.length), Array(9).fill(0));
});

test('新鲜度体检只数 stale 标记，不读当前时间', () => {
  const tools = [KLING, { ...KLING, slug: 'b', stale: true }, { ...KLING, slug: 'c', stale: true }];
  assert.equal(countStale(tools), 2);
  assert.equal(countStale([]), 0);
});

test('下载文件名是 ASCII 前缀 + 日期，扩展名不可注入', () => {
  assert.equal(stackFileName('2026-10-23'), 'tryworld-stack-2026-10-23.md');
  assert.equal(stackFileName('2026-10-23', 'txt'), 'tryworld-stack-2026-10-23.txt');
  assert.equal(stackFileName('2026-10-23', '../../etc/passwd'), 'tryworld-stack-2026-10-23.md');
});
