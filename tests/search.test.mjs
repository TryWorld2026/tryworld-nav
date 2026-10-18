/**
 * 搜索回归（纯函数级，不需要浏览器、不需要构建）。
 *
 * 守的是什么：2026-10-18 之前的搜索是纯小写子串匹配，22 个真实用户意图词里
 * 有 6 个（写代码、做视频、论文润色、小红书文案、做网站、电商详情页）在
 * `Ctrl+K` 与 `/tools` 两处**都是 0 命中** —— 而同一意图换个词立刻有结果。
 * 供给是够的，断的是入口。
 *
 * 这组用例把「22 个意图词都必须有条目」钉死：将来有人把 `INTENTS` 或
 * `LEXICON` 改坏、或者把索引生成脚本的净化规则调过头，这里会先红。
 *
 *   node --test tests/search.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expandQuery, searchIndex, filterRecords, INTENTS, LEXICON } from '../src/lib/search.ts';

const INDEX = JSON.parse(readFileSync(join(process.cwd(), 'data', 'search-index.json'), 'utf8'));

/** 审计报告里跑过的 22 个真实意图词。 */
const INTENT_QUERIES = [
  '写代码',
  '做视频',
  '抠图',
  '论文润色',
  '简历',
  '小红书文案',
  '配音',
  'PPT',
  '法律',
  '数字人',
  '翻译',
  '做网站',
  '会议记录',
  '思维导图',
  '数据分析',
  '语音转文字',
  '图片生成',
  '去水印',
  '面试',
  '提示词',
  '漫画',
  '电商详情页',
];

test('22 个真实意图词全部至少命中 1 条', () => {
  const misses = [];
  for (const q of INTENT_QUERIES) {
    const hits = searchIndex(INDEX, q, 30);
    if (hits.length === 0) misses.push(q);
  }
  assert.deepEqual(misses, [], `这些意图词仍然 0 命中：${misses.join('、')}`);
});

test('意图词的前 3 条里至少有一条名称/简介/关键词真正相关', () => {
  // 「视频」→ 工具名前 3 应该都是视频类，而不是随便什么
  const hits = searchIndex(INDEX, '视频', 3);
  assert.ok(hits.length === 3, '「视频」应至少有 3 条结果');
  const names = hits.map((h) => INDEX.find((r) => r.s === h.slug)?.n ?? '');
  assert.ok(
    names.some((n) => n.includes('视频')),
    `「视频」前 3 条里应至少有一个名字带「视频」，实际：${names.join(' / ')}`,
  );
});

test('expandQuery 把「写代码」展开成代码相关词，原词排第一', () => {
  const terms = expandQuery('写代码');
  assert.equal(terms[0], '写代码', '用户原话必须排在第一位（精确命中优先）');
  for (const expected of ['代码', '编程', '补全']) {
    assert.ok(terms.includes(expected), `应展开出「${expected}」，实际：${terms.join(',')}`);
  }
  assert.deepEqual(expandQuery('   '), [], '空串应返回空数组');
});

test('别名命中不会盖过精确名称命中', () => {
  // 「PPT」是意图键；名字里就叫 PPT 的工具应排在使用别名命中的工具之前。
  const hits = searchIndex(INDEX, 'PPT', 10);
  const first = INDEX.find((r) => r.s === hits[0]?.slug);
  assert.ok(first, '应有结果');
  assert.ok(
    first.n.toLowerCase().includes('ppt'),
    `第一条应是名称含 PPT 的工具，实际是「${first.n}」`,
  );
});

test('同一查询两次结果完全一致（排序稳定）', () => {
  const a = searchIndex(INDEX, '翻译', 10).map((h) => h.slug);
  const b = searchIndex(INDEX, '翻译', 10).map((h) => h.slug);
  assert.deepEqual(a, b);
});

test('空查询与纯空白不返回结果（由界面走推荐分支）', () => {
  assert.deepEqual(searchIndex(INDEX, '', 10), []);
  assert.deepEqual(searchIndex(INDEX, '   ', 10), []);
});

test('完全没有对应条目的乱码串返回空数组而不是报错', () => {
  assert.deepEqual(searchIndex(INDEX, 'zzzzqqqq不存在的东西', 10), []);
});

test('limit 生效', () => {
  assert.equal(searchIndex(INDEX, '视频', 5).length, 5);
  assert.equal(searchIndex(INDEX, '视频', Number.POSITIVE_INFINITY).length > 5, true);
});

test('filterRecords：分类多选是并集，标签是精确匹配', () => {
  const onlyCoding = filterRecords(INDEX, { categories: ['ai-coding'] });
  assert.ok(onlyCoding.length > 0);
  assert.ok(onlyCoding.every((r) => r.c.includes('ai-coding')));

  const twoCats = filterRecords(INDEX, { categories: ['ai-coding', 'ai-writing'] });
  assert.ok(
    twoCats.length > onlyCoding.length,
    '两个分类应比一个分类宽（并集）',
  );

  const tagged = filterRecords(INDEX, { tag: '编辑推荐' });
  assert.ok(tagged.every((r) => r.t.includes('编辑推荐')));
});

test('filterRecords：price=free 只留白名单里的 slug', () => {
  const free = new Set(INDEX.slice(0, 5).map((r) => r.s));
  const got = filterRecords(INDEX, { price: 'free', freeSlugs: free });
  assert.equal(got.length, 5);
  assert.ok(got.every((r) => free.has(r.s)));
});

test('索引条目形状：每条都有 slug/name/icon，且 slug 唯一', () => {
  const seen = new Set();
  for (const r of INDEX) {
    assert.equal(typeof r.s, 'string');
    assert.ok(r.s.length > 0, 'slug 不能为空');
    assert.ok(!seen.has(r.s), `slug 重复：${r.s}`);
    seen.add(r.s);
    assert.ok(r.n && r.n.length > 0, `${r.s} 缺名称`);
    assert.ok(r.i && r.i.startsWith('/assets/'), `${r.s} 的 icon 路径异常：${r.i}`);
    assert.ok(Array.isArray(r.c), `${r.s} 的分类不是数组`);
  }
});

test('索引里的关键词全部来自词表，没有脏数据', () => {
  // 反向守住生成脚本：`k` 里的词必须能被解释，避免有人手工塞词。
  // 允许两个来源：LEXICON（打标用）与 INTENTS 的别名（展开时会用到同一个词）。
  // 「指令」「总结」「译」这类短词正是 INTENTS 的别名 —— 生成脚本只读 LEXICON，
  // 而断言如果把两者混在一起判，就会把合法数据判成脏数据。
  const allowed = new Set([
    ...LEXICON.map((w) => w.toLowerCase()),
    ...Object.values(INTENTS).flat().map((w) => w.toLowerCase()),
  ]);
  const offenders = [];
  for (const r of INDEX) {
    for (const w of r.k ?? []) {
      if (!allowed.has(w)) offenders.push(`${r.s}:${w}`);
    }
  }
  assert.deepEqual(offenders.slice(0, 10), [], `出现词表外的关键词：${offenders.join(' ')}`);
});

test('每个意图键都至少展开出一个别名', () => {
  for (const [intent, aliases] of Object.entries(INTENTS)) {
    assert.ok(aliases.length > 0, `意图「${intent}」没有别名`);
    assert.ok(
      aliases.every((a) => a.trim().length > 0),
      `意图「${intent}」有空白别名`,
    );
  }
});
