/**
 * `/tools` 筛选状态 ⇄ URL 的回归（纯函数级）。
 *
 * 守的是什么：筛选状态不写 URL 是这轮审计里「最伤用户」的一条
 * （work/analysis-ia.md §9①）—— 筛到 297 条，点进详情再返回，变回 2081、
 * 输入框清空、滚动位置从 1200 掉到 160。修复的前提是这对函数必须可逆、
 * 且同一个状态永远生成同一个 URL（否则分享出去的链接看起来不一样）。
 *
 *   node --test tests/filter-url.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildFilter, emptyFilter, hasFilter, parseFilter } from '../src/lib/filter-url.ts';

test('空状态序列化成空串（不是 "?q=&cat="）', () => {
  assert.equal(buildFilter(emptyFilter()), '');
});

test('至少有一个条件时才带问号', () => {
  const s = { q: '视频', cats: [], tag: '', price: '' };
  assert.equal(buildFilter(s), '?q=%E8%A7%86%E9%A2%91');
});

test('parse ⇄ build 往返一致', () => {
  const s = { q: 'PPT', cats: ['ai-ppt'], tag: '编辑推荐', price: 'free' };
  const round = parseFilter(buildFilter(s));
  assert.deepEqual(round, s);
});

test('多选分类按逗号分隔且保序', () => {
  const s = { q: '', cats: ['ai-coding', 'ai-writing'], tag: '', price: '' };
  const qs = buildFilter(s);
  assert.equal(qs, '?cat=ai-coding%2Cai-writing');
  assert.deepEqual(parseFilter(qs).cats, ['ai-coding', 'ai-writing']);
});

test('键顺序固定：q → cat → tag → price（同一状态只有一种 URL）', () => {
  const a = { q: 'x', cats: ['c'], tag: 't', price: 'free' };
  const b = { price: 'free', tag: 't', cats: ['c'], q: 'x' };
  assert.equal(buildFilter(a), buildFilter(b));
});

test('解析时忽略未知键、去重、去空', () => {
  const parsed = parseFilter('?q=视频&cat=ai-coding,ai-coding,,ai-writing&nope=1&tag=');
  assert.equal(parsed.q, '视频');
  assert.deepEqual(parsed.cats, ['ai-coding', 'ai-writing']);
  assert.equal(parsed.tag, '');
});

test('非法 price 值被忽略（只有 free 有意义）', () => {
  assert.equal(parseFilter('?price=cheap').price, '');
  assert.equal(parseFilter('?price=free').price, 'free');
});

test('接受不带问号的串（location.search 在部分场景为空串）', () => {
  assert.equal(parseFilter('q=abc').q, 'abc');
});

test('hasFilter 覆盖四种条件', () => {
  assert.equal(hasFilter(emptyFilter()), false);
  assert.equal(hasFilter({ q: ' ', cats: [], tag: '', price: '' }), false);
  assert.equal(hasFilter({ q: 'x', cats: [], tag: '', price: '' }), true);
  assert.equal(hasFilter({ q: '', cats: ['a'], tag: '', price: '' }), true);
  assert.equal(hasFilter({ q: '', cats: [], tag: 't', price: '' }), true);
  assert.equal(hasFilter({ q: '', cats: [], tag: '', price: 'free' }), true);
});

test('中文与空格被正确编码/解码', () => {
  const s = { q: '做视频', cats: [], tag: '完全免费', price: '' };
  const round = parseFilter(buildFilter(s));
  assert.equal(round.q, '做视频');
  assert.equal(round.tag, '完全免费');
});

test('空串与全空白查询不写进 URL', () => {
  assert.equal(buildFilter({ q: '   ', cats: [], tag: '', price: '' }), '');
});
