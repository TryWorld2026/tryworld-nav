/**
 * 卡片数据层与卡片排序的回归（纯函数级）。
 *
 * 守的是什么：同一张 `ToolMiniCard` 在站内有**两种数据来源** —— 服务端页面
 * 传完整 `Tool`（结构上满足 `CardTool`），客户端传 `cardFromRecord()` /
 * `cardFromTool()` 转换后的结果。2026-10-22 实测的缺陷正是这个收敛没做完：
 * `cardFromTool()` 写好了但只在详情页的 rail 里被调用，四处 `ToolMiniCard`
 * 仍传裸 `Tool`，而裸 `Tool` 没有价格/平台/更新时间 ——
 * 卡片底部那条「可比较的事实」**整块不渲染且不报错**。
 *
 * 这组用例守两件事：
 *   1. `sortCards()` 的语义与 `search.ts` 的 `sortRecords()` **逐条一致**
 *      （两者是两份实现，必须同步；漂移了就会「分类页和 /tools 排序不同」）
 *   2. `freshLabel()` 只在真的新鲜时才说话 —— 审计实测 88.75% 的条目超过
 *      一年，把「更新于 2025-10-11」印在每张卡上等于把陈旧包装成卖点
 *
 *   node --test tests/card.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { freshLabel, sortCards } from '../src/lib/card-sort.ts';
import { decodeSearchIndex, sortRecords } from '../src/lib/search.ts';

const INDEX = decodeSearchIndex(
  JSON.parse(readFileSync(join(process.cwd(), 'data', 'search-index.json'), 'utf8')),
);

/** 造一张最小卡片。只填排序要用的字段，其余给稳定的默认值。 */
function card(patch = {}) {
  return {
    slug: 'x',
    name: 'X',
    description: '',
    icon: '',
    tags: [],
    categories: [],
    price: 'unrated',
    updated: undefined,
    platforms: [],
    ...patch,
  };
}

test('sortCards 与 sortRecords 的「最近更新」语义完全一致', () => {
  // 两份实现（CardTool 一份、SearchRecord 一份）必须给出同样的顺序，
  // 否则分类页与 /tools 对同一批工具排出两种次序。
  const sample = INDEX.slice(0, 60);
  const asCards = sample.map((r) => card({ slug: r.s, name: r.n, updated: r.u }));

  const fromRecords = sortRecords(sample, 'updated').map((r) => r.s);
  const fromCards = sortCards(asCards, 'updated').map((c) => c.slug);
  assert.deepEqual(fromCards, fromRecords, '两种实现的「最近更新」顺序应完全相同');
});

test('sortCards 与 sortRecords 的「按名称」语义完全一致', () => {
  const sample = INDEX.slice(0, 60);
  const asCards = sample.map((r) => card({ slug: r.s, name: r.n, updated: r.u }));

  const fromRecords = sortRecords(sample, 'name').map((r) => r.s);
  const fromCards = sortCards(asCards, 'name').map((c) => c.slug);
  assert.deepEqual(fromCards, fromRecords, '两种实现的「按名称」顺序应完全相同');
});

test('sortCards：未采集更新时间的条目稳定置后，不与真实时间抢位', () => {
  const cards = [
    card({ slug: 'no-time', updated: undefined }),
    card({ slug: 'old', updated: 20000 }),
    card({ slug: 'new', updated: 20700 }),
  ];
  assert.deepEqual(
    sortCards(cards, 'updated').map((c) => c.slug),
    ['new', 'old', 'no-time'],
    '没时间的必须排在最后',
  );
});

test('sortCards：默认排序保持传入顺序（原站手调目录序）', () => {
  const cards = [card({ slug: 'c' }), card({ slug: 'a' }), card({ slug: 'b' })];
  assert.deepEqual(sortCards(cards, '').map((c) => c.slug), ['c', 'a', 'b']);
});

test('sortCards 不修改传入数组', () => {
  const cards = [card({ slug: 'b', updated: 1 }), card({ slug: 'a', updated: 2 })];
  const before = cards.map((c) => c.slug);
  sortCards(cards, 'updated');
  assert.deepEqual(cards.map((c) => c.slug), before, '排序不应原地改动入参');
});

test('freshLabel：只在 90 天内说话，超过就不提', () => {
  const epoch = 20700;
  assert.equal(freshLabel(epoch, epoch), '近期更新');
  assert.equal(freshLabel(epoch - 3, epoch), '3 天前更新');
  assert.equal(freshLabel(epoch - 14, epoch), '2 周前更新');
  assert.equal(freshLabel(epoch - 60, epoch), '2 个月前更新');
  // 91 天起返回空串 —— 审计实测 88.75% 的条目超一年，说「更新于 …」等于
  // 把陈旧包装成新鲜度信号。
  assert.equal(freshLabel(epoch - 91, epoch), '');
  assert.equal(freshLabel(epoch - 400, epoch), '');
});

test('freshLabel：缺数据时返回空串，绝不写「未知」', () => {
  assert.equal(freshLabel(undefined, 20700), '');
  assert.equal(freshLabel(20600, undefined), '');
  assert.equal(freshLabel(undefined, undefined), '');
});
