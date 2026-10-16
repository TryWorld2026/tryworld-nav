/**
 * 时间格式化的测试。
 *
 * 为什么这几条值得测：`publishedAt` 是 ISO-8601 UTC，而读者在中国。格式化一旦
 * 退回「直接切字符串」（`publishedAt.slice(0,10)`），日期就会在 UTC 16:00–24:00
 * 之间**整整差一天**，而且页面上完全看不出来 —— 只是日期悄悄错了。这类 bug 没有
 * 测试基本发现不了。
 *
 * 用 Node 内置的 `node --test`，不引入任何依赖。Node 24 可直接 import `.ts`
 * （类型剥离），所以测试文件是 `.mjs` 也能测 TypeScript 源码。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDateTime, formatDateShort, relativeLabel } from '../src/lib/news.ts';

test('formatDate 按北京时间渲染，而不是 UTC 日期', () => {
  // 11:00Z = 北京 19:00 同日
  assert.equal(formatDate('2026-10-15T11:00:00.000Z'), '2026年10月15日');
  // 18:00Z = 北京次日 02:00 —— 这一条就是「切字符串会错一天」的边界
  assert.equal(formatDate('2026-10-14T18:00:00.000Z'), '2026年10月15日');
  // 15:59Z = 北京 23:59 同日
  assert.equal(formatDate('2026-10-14T15:59:00.000Z'), '2026年10月14日');
  // 16:00Z = 北京次日 00:00
  assert.equal(formatDate('2026-10-14T16:00:00.000Z'), '2026年10月15日');
});

test('formatDateShort 用斜杠格式且不补零（与原站一致）', () => {
  assert.equal(formatDateShort('2026-10-15T11:00:00.000Z'), '2026/10/15');
  // 个位数月份/日期**不**补零 —— 原站就是 `2025/8/14` 这种写法
  // （核对了 data/news.json 被 AIHOT 取代前那十篇的 dateShort，全是非补零）。
  assert.equal(formatDateShort('2026-01-05T11:00:00.000Z'), '2026/1/5');
  assert.equal(formatDateShort('2026-10-15T18:00:00.000Z'), '2026/10/16');
});

test('formatDateTime 带上北京时间的小时分钟', () => {
  const s = formatDateTime('2026-10-15T11:00:00.000Z');
  assert.match(s, /2026年10月15日/);
  assert.match(s, /19:00/);
});

test('空值/非法值回退成空串，而不是 Invalid Date', () => {
  for (const bad of [null, undefined, '', 'not-a-date', 'abc']) {
    assert.equal(formatDate(bad), '', `formatDate(${JSON.stringify(bad)})`);
    assert.equal(formatDateShort(bad), '', `formatDateShort(${JSON.stringify(bad)})`);
    assert.equal(formatDateTime(bad), '', `formatDateTime(${JSON.stringify(bad)})`);
    assert.equal(relativeLabel(bad), '', `relativeLabel(${JSON.stringify(bad)})`);
  }
});

test('relativeLabel 以构建时刻为基准，且按北京日历日计算', () => {
  const now = new Date('2026-10-15T04:00:00.000Z'); // 北京 10-15 12:00
  assert.equal(relativeLabel('2026-10-15T02:00:00.000Z', now), '今天');
  assert.equal(relativeLabel('2026-10-14T02:00:00.000Z', now), '昨天');
  assert.equal(relativeLabel('2026-10-12T02:00:00.000Z', now), '3 天前');
  // 超过 7 天不再给相对标签（绝对日期已经显示了）
  assert.equal(relativeLabel('2026-10-01T02:00:00.000Z', now), '');
});

test('relativeLabel 的「昨天」跨 UTC 午夜仍然正确', () => {
  // now = 北京 10-15 00:30（UTC 10-14 16:30）
  const now = new Date('2026-10-14T16:30:00.000Z');
  // 北京 10-14 23:00 —— 按北京日历是「昨天」，但 UTC 日期只差 7 小时
  assert.equal(relativeLabel('2026-10-14T15:00:00.000Z', now), '昨天');
  // 北京 10-15 00:10 —— 同一天
  assert.equal(relativeLabel('2026-10-14T16:10:00.000Z', now), '今天');
});

test('未来时间不会渲染成负数天数', () => {
  const now = new Date('2026-10-15T04:00:00.000Z');
  // diff <= 0 一律算「今天」，避免出现「-1 天前」
  assert.equal(relativeLabel('2026-10-16T04:00:00.000Z', now), '今天');
});
