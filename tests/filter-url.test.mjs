/**
 * `/tools` 筛选状态 ⇄ URL 的回归（纯函数级）。
 *
 * 守的是什么：筛选状态不写 URL 是这轮审计里「最伤用户」的一条
 * （work/analysis-ia.md §9①）—— 筛到 297 条，点进详情再返回，变回 2081、
 * 输入框清空、滚动位置从 1200 掉到 160。修复的前提是这对函数必须可逆、
 * 且同一个状态永远生成同一个 URL（否则分享出去的链接看起来不一样）。
 *
 * 2026-10-22：状态从 `{q, cats, tag, price}` 扩到
 * `{q, cats, tags, price, platforms, sort, page}` —— 加了平台、排序与页码，
 * 标签也从单选变多选。URL 键序固定为
 * `q → cat → tag → price → platform → sort → page`，默认值一律省略
 * （否则 `?q=&cat=&tag=` 这种空壳链接会被分享出去）。
 *
 *   node --test tests/filter-url.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFilter,
  clampPage,
  emptyFilter,
  hasFilter,
  parseFilter,
} from '../src/lib/filter-url.ts';

/** 造一个只覆盖需要字段的状态，其余取默认 —— 避免每条用例都写 7 个键。 */
function state(patch = {}) {
  return { ...emptyFilter(), ...patch };
}

test('空状态序列化成空串（不是 "?q=&cat="）', () => {
  assert.equal(buildFilter(emptyFilter()), '');
});

test('至少有一个条件时才带问号', () => {
  assert.equal(buildFilter(state({ q: '视频' })), '?q=%E8%A7%86%E9%A2%91');
});

test('parse ⇄ build 往返一致', () => {
  const s = state({
    q: 'PPT',
    cats: ['ai-ppt'],
    tags: ['编辑推荐'],
    price: 'free',
    platforms: ['Web'],
    sort: 'updated',
    page: 3,
  });
  assert.deepEqual(parseFilter(buildFilter(s)), s);
});

test('多选分类按逗号分隔且保序', () => {
  const qs = buildFilter(state({ cats: ['ai-coding', 'ai-writing'] }));
  assert.equal(qs, '?cat=ai-coding%2Cai-writing');
  assert.deepEqual(parseFilter(qs).cats, ['ai-coding', 'ai-writing']);
});

test('多选标签与多选平台同样按逗号分隔', () => {
  const qs = buildFilter(state({ tags: ['编辑推荐', '完全免费'], platforms: ['Web', 'iOS'] }));
  const round = parseFilter(qs);
  assert.deepEqual(round.tags, ['编辑推荐', '完全免费']);
  assert.deepEqual(round.platforms, ['Web', 'iOS']);
});

test('键顺序固定：q → cat → tag → price → platform → sort → page', () => {
  const a = state({ q: 'x', cats: ['c'], tags: ['t'], price: 'free', platforms: ['Web'], sort: 'name', page: 2 });
  const b = state({ page: 2, sort: 'name', platforms: ['Web'], price: 'free', tags: ['t'], cats: ['c'], q: 'x' });
  assert.equal(buildFilter(a), buildFilter(b));
  assert.equal(
    buildFilter(a),
    '?q=x&cat=c&tag=t&price=free&platform=Web&sort=name&page=2',
    '键顺序变了同一个筛选就会生成两种 URL',
  );
});

test('默认值不写进 URL（sort=default / page=1 / 空串都省略）', () => {
  assert.equal(buildFilter(state({ sort: '', page: 1 })), '');
  assert.equal(buildFilter(state({ q: '   ', cats: [], tags: [], price: '', platforms: [] })), '');
});

test('解析时忽略未知键、去重、去空', () => {
  const parsed = parseFilter('?q=视频&cat=ai-coding,ai-coding,,ai-writing&nope=1&tag=');
  assert.equal(parsed.q, '视频');
  assert.deepEqual(parsed.cats, ['ai-coding', 'ai-writing']);
  assert.deepEqual(parsed.tags, []);
});

test('非法 price / sort 值被静默降级（用户可能手改 URL）', () => {
  assert.equal(parseFilter('?price=cheap').price, '');
  assert.equal(parseFilter('?price=free').price, 'free');
  assert.equal(parseFilter('?price=freemium').price, 'freemium');
  assert.equal(parseFilter('?sort=hot').sort, '');
  assert.equal(parseFilter('?sort=updated').sort, 'updated');
  assert.equal(parseFilter('?sort=name').sort, 'name');
});

test('页码：非正整数回退 1，超出总页数被夹回', () => {
  assert.equal(parseFilter('?page=3').page, 3);
  assert.equal(parseFilter('?page=0').page, 1);
  assert.equal(parseFilter('?page=-2').page, 1);
  assert.equal(parseFilter('?page=abc').page, 1);
  assert.equal(parseFilter('?page=1.5').page, 1);
  assert.equal(clampPage(9, 3), 3);
  assert.equal(clampPage(2, 3), 2);
  assert.equal(clampPage(0, 3), 1);
  assert.equal(clampPage(5, 1), 1);
});

test('接受不带问号的串（location.search 在部分场景为空串）', () => {
  assert.equal(parseFilter('q=abc').q, 'abc');
});

test('hasFilter 覆盖所有条件，但页码不算筛选', () => {
  assert.equal(hasFilter(emptyFilter()), false);
  assert.equal(hasFilter(state({ q: ' ' })), false);
  assert.equal(hasFilter(state({ q: 'x' })), true);
  assert.equal(hasFilter(state({ cats: ['a'] })), true);
  assert.equal(hasFilter(state({ tags: ['t'] })), true);
  assert.equal(hasFilter(state({ price: 'free' })), true);
  assert.equal(hasFilter(state({ platforms: ['Web'] })), true);
  assert.equal(hasFilter(state({ sort: 'updated' })), true);
  // 页码不是筛选条件 —— 只翻页不该让「重置筛选」按钮冒出来。
  assert.equal(hasFilter(state({ page: 4 })), false);
});

test('中文与空格被正确编码/解码', () => {
  const s = state({ q: '做视频', tags: ['完全免费'] });
  const round = parseFilter(buildFilter(s));
  assert.equal(round.q, '做视频');
  assert.deepEqual(round.tags, ['完全免费']);
});
