/**
 * 收藏存储的回归（纯函数级）。
 *
 * 守两件事：
 *   1. **老数据不能丢**。v1 是 `["slug", ...]`（2026-10 之前写入的），
 *      v2 是 `{version:2, items:[...]}`。升级时读到 v1 必须还能渲染，
 *      而且首次写入要自动落成 v2 —— 用户存过的东西不能被静默清空。
 *   2. **畸形输入不能炸**。隐私模式、被别的脚本写坏、跨版本残留都可能让
 *      解析拿到意外内容；「收藏页白屏」比「收藏丢了」更糟。
 *
 *   node --test tests/favorites.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyStore,
  isFavorite,
  parseStore,
  serializeStore,
  toggleFavorite,
  STORAGE_KEY,
} from '../src/lib/favorites.ts';

/** @type {import('../src/lib/favorites.ts').FavoriteItem} */
const ITEM = {
  slug: 'lovart-ai',
  name: 'Lovart',
  description: '全球首个专业AI设计Agent',
  icon: '/assets/icons/lovart-ai.png',
  category: { slug: 'ai-image-design', name: 'AI图像/设计', color: '244 63 94' },
};

test('存储键名固定，改名会让所有老用户的收藏消失', () => {
  assert.equal(STORAGE_KEY, 'tryworld:favorites');
});

test('v1（纯 slug 数组）能读出来，并转成带兜底名称的条目', () => {
  const store = parseStore('["lovart-ai","cursor"]');
  assert.equal(store.version, 2);
  assert.deepEqual(
    store.items.map((i) => i.slug),
    ['lovart-ai', 'cursor'],
  );
  // 没名字时用 slug 兜底，界面上至少不是空白
  assert.equal(store.items[0].name, 'lovart-ai');
  assert.equal(store.items[0].description, '');
});

test('v2 往返：serialize → parse 内容一致', () => {
  const store = { version: 2, items: [ITEM] };
  const round = parseStore(serializeStore(store));
  assert.deepEqual(round.items, [ITEM]);
});

test('空/损坏输入一律降级成空 store，不抛错', () => {
  for (const raw of [null, undefined, '', 'not json', '{', '{"version":2}', '{"items":"nope"}', '42']) {
    const store = parseStore(raw);
    assert.deepEqual(store, emptyStore(), `输入 ${String(raw)} 应降级成空 store`);
  }
});

test('toggle 已在收藏里的条目 = 移除', () => {
  const start = { version: 2, items: [ITEM] };
  const { store, added } = toggleFavorite(start, ITEM, '2026-10-18T00:00:00.000Z');
  assert.equal(added, false);
  assert.equal(store.items.length, 0);
});

test('toggle 新条目 = 插到最前并带时间戳', () => {
  const older = { ...ITEM, slug: 'cursor', name: 'Cursor' };
  const start = { version: 2, items: [older] };
  const { store, added } = toggleFavorite(start, ITEM, '2026-10-18T00:00:00.000Z');
  assert.equal(added, true);
  assert.equal(store.items.length, 2);
  assert.equal(store.items[0].slug, 'lovart-ai', '新收藏应在最前面');
  assert.equal(store.items[0].addedAt, '2026-10-18T00:00:00.000Z');
});

test('toggle 两次回到原状（幂等）', () => {
  const start = emptyStore();
  const once = toggleFavorite(start, ITEM).store;
  const twice = toggleFavorite(once, ITEM).store;
  assert.deepEqual(twice.items, []);
});

test('isFavorite 按 slug 判断', () => {
  const store = { version: 2, items: [ITEM] };
  assert.equal(isFavorite(store, 'lovart-ai'), true);
  assert.equal(isFavorite(store, 'cursor'), false);
});

test('批量写入不超过 500 条上限', () => {
  let store = emptyStore();
  for (let i = 0; i < 520; i++) {
    store = toggleFavorite(store, { ...ITEM, slug: `tool-${i}`, name: `T${i}` }).store;
  }
  assert.equal(store.items.length, 500);
  // 最新的在最前，最老的被挤掉
  assert.equal(store.items[0].slug, 'tool-519');
  assert.ok(!store.items.some((it) => it.slug === 'tool-0'));
});

test('v1 老数据在下次写入时自动升级成 v2 结构', () => {
  const migrated = parseStore('["lovart-ai"]');
  const upgraded = toggleFavorite(migrated, { ...ITEM, slug: 'cursor', name: 'Cursor' }).store;
  const persisted = JSON.parse(serializeStore(upgraded));
  assert.equal(persisted.version, 2, '写回时必须是 v2');
  assert.equal(persisted.items.length, 2);
  assert.equal(persisted.items[0].slug, 'cursor');
});
