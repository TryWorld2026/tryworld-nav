/**
 * 工具栈分享链接与批量收藏的回归（纯函数级）。
 *
 * 守三件事：
 *   1. **写出去的链接一定能读回来**。编码与解码共用同一条清洗路径，
 *      否则会出现「复制成功的链接对方打开是空页」这种最难排查的 bug。
 *   2. **外部输入一律当脏数据**。链接是别人发来的，可能被截断、被手动改、
 *      被塞进 `javascript:` 或超长 slug —— 这些必须被挡在入口，不能让
 *      它们变成页面上的图标 src 或跳转地址。
 *   3. **批量收藏不删已有条目**。收件人的链接里有一半是自己已有的工具时，
 *      点「保存」只该加新的，绝不能把他自己的收藏清掉。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareUrl,
  decodeStackParam,
  encodeStackParam,
  normalizeSlugs,
  sharePath,
  STACK_MAX,
  STACK_PARAM,
} from '../src/lib/stack-share.ts';
import { mergeFavorites, toggleFavorite, emptyStore } from '../src/lib/favorites.ts';

const item = (slug, name = slug) => ({ slug, name, description: '', icon: '' });

test('编码与解码是互逆的（顺序、去重都保留）', () => {
  const slugs = ['lovart-ai', 'cursor', 'lovart-ai', 'hedra'];
  const param = encodeStackParam(slugs);
  assert.equal(param, 'lovart-ai,cursor,hedra');
  assert.deepEqual(decodeStackParam(param), ['lovart-ai', 'cursor', 'hedra']);
});

test('空输入给出空结果，而不是 "null" / "undefined" 字符串', () => {
  assert.equal(encodeStackParam([]), '');
  assert.equal(encodeStackParam(null), '');
  assert.equal(encodeStackParam(undefined), '');
  assert.deepEqual(decodeStackParam(''), []);
  assert.deepEqual(decodeStackParam(null), []);
  assert.deepEqual(decodeStackParam('  ,  ,   '), []);
});

test('脏 slug 被挡掉：协议、大写路径、中文、超长、下划线', () => {
  const dirty = [
    'javascript:alert(1)',
    'lovart ai',
    '工具',
    'a'.repeat(100),
    'lovart_ai',
    '-leading-dash',
    '',
  ];
  assert.deepEqual(normalizeSlugs(dirty), []);
  // 大小写会被归一化成小写（目录里的 slug 全是小写 kebab-case）
  assert.deepEqual(normalizeSlugs(['Lovart-AI']), ['lovart-ai']);
});

test('超过上限时截断到 STACK_MAX，且保留最前面的', () => {
  const many = Array.from({ length: STACK_MAX + 12 }, (_, i) => `tool-${i}`);
  const out = normalizeSlugs(many);
  assert.equal(out.length, STACK_MAX);
  assert.equal(out[0], 'tool-0');
  assert.equal(out.at(-1), `tool-${STACK_MAX - 1}`);
});

test('sharePath：有内容带 ?ids=，没有内容回到 /stack', () => {
  assert.equal(sharePath(['a1', 'b2']), `/stack?${STACK_PARAM}=a1,b2`);
  assert.equal(sharePath([]), '/stack');
});

test('buildShareUrl：吃掉 base 末尾斜杠，不产生 //stack', () => {
  assert.equal(buildShareUrl('https://nav.tryworld.com.cn/', ['x']), 'https://nav.tryworld.com.cn/stack?ids=x');
  assert.equal(buildShareUrl('https://nav.tryworld.com.cn', ['x']), 'https://nav.tryworld.com.cn/stack?ids=x');
});

test('mergeFavorites：只加新的，不删已有的，顺序保持链接顺序', () => {
  const base = emptyStore();
  const first = mergeFavorites(base, [item('a'), item('b')], '2026-10-23T00:00:00.000Z');
  assert.equal(first.added, 2);
  assert.deepEqual(first.store.items.map((i) => i.slug), ['a', 'b']);

  const second = mergeFavorites(first.store, [item('c'), item('a')], '2026-10-23T01:00:00.000Z');
  assert.equal(second.added, 1, 'a 已存在，只加 c');
  assert.deepEqual(second.store.items.map((i) => i.slug), ['c', 'a', 'b'], '新条目在最前，已有条目一个不少');
  assert.equal(second.store.items[0].addedAt, '2026-10-23T01:00:00.000Z');
});

test('mergeFavorites：全是已有条目时 added=0 且 store 引用不变', () => {
  const { store } = mergeFavorites(emptyStore(), [item('a')]);
  const again = mergeFavorites(store, [item('a')]);
  assert.equal(again.added, 0);
  assert.equal(again.store, store);
});

test('mergeFavorites 与 toggleFavorite 不冲突：单条取消收藏后仍能批量加回', () => {
  const { store } = mergeFavorites(emptyStore(), [item('a'), item('b')]);
  const off = toggleFavorite(store, item('a')).store;
  assert.deepEqual(off.items.map((i) => i.slug), ['b']);
  const back = mergeFavorites(off, [item('a')]);
  assert.deepEqual(back.store.items.map((i) => i.slug), ['a', 'b']);
});
