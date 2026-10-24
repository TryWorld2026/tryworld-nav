/**
 * 「为什么这条会出现」的回归（纯函数级）。
 *
 * 这一行的全部价值是**可核对**：它只复述检索层真的命中了什么。所以测试守的
 * 是「不许说多」——没有命中依据时必须返回空串让调用方退回简介，而不是
 * 编一句「高度相关」。
 *
 *   node --test tests/search-reason.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REASON_MAX_TERMS, searchReason } from '../src/lib/search-reason.ts';

test('没有任何命中依据时返回空串（调用方据此退回简介）', () => {
  assert.deepEqual(searchReason({}), { terms: '', field: null, line: '' });
  assert.equal(searchReason({ matchedFields: [], matchedTerms: [] }).line, '');
  // 空白词不算依据
  assert.equal(searchReason({ matchedTerms: ['  ', ''] }).line, '');
});

test('命中的词就是用户原话时：关键词/简介等说「命中在哪」，名称则干脆不说', () => {
  // 名称命中且就是原话 → 没有解释力，交给简介（空串）
  assert.equal(searchReason({ matchedFields: ['name'], matchedTerms: ['小红书'] }, '小红书').line, '');
  // 简介 / 关键词命中仍有「命中在哪」的信息，且相邻行会不同
  assert.equal(
    searchReason({ matchedFields: ['description'], matchedTerms: ['小红书'] }, '小红书').line,
    '因为命中简介',
  );
  assert.equal(
    searchReason({ matchedFields: ['keyword'], matchedTerms: ['小红书'] }, '小红书').line,
    '因为命中关键词',
  );
});

test('同义展开命中的词（不是用户原话）才值得展示', () => {
  const r = searchReason(
    { matchedFields: ['keyword'], matchedTerms: ['剪视频', '视频剪辑'] },
    '剪视频',
  );
  assert.equal(r.line, '因为命中关键词：视频剪辑', '应展示展开出来的词，而不是复读原话');
});

test('命中非名称字段时补上字段名，读者才知道命中在哪', () => {
  assert.equal(
    searchReason({ matchedFields: ['keyword'], matchedTerms: ['小红书'] }).line,
    '因为命中关键词：小红书',
  );
  assert.equal(
    searchReason({ matchedFields: ['category'], matchedTerms: ['视频'] }).line,
    '因为命中分类：视频',
  );
});

test('只有字段没有词：仍然给一句可读的话', () => {
  assert.equal(searchReason({ matchedFields: ['tag'] }).line, '因为命中标签');
});

test('多个命中词截断到上限，并加「等」', () => {
  const words = ['公众号排版', '排版', '样式', '模板'];
  const r = searchReason({ matchedFields: ['keyword'], matchedTerms: words }, '公众号排版');
  assert.ok(r.line.includes('排版'), '应保留第一个展开词');
  assert.ok(r.line.includes('等'), '超过上限应有「等」');
  assert.ok(!r.line.includes('模板'), '超出上限的词不应出现');
  assert.equal(REASON_MAX_TERMS, 2);
});

test('主依据取权重最高的字段，而不是数组里的第一个', () => {
  // 真数据里出现过 category 排在 name 前面
  const r = searchReason({ matchedFields: ['category', 'name'], matchedTerms: ['figma'] }, 'figma');
  assert.equal(r.field, '名称', '名称权重高于分类，应作为主依据');
  // 名称命中 + 词就是原话 → 不出文案（交给简介），但 field 仍如实回报
  assert.equal(r.line, '');
});

test('未知字段被忽略，不会把内部名泄漏到界面上', () => {
  const r = searchReason(
    { matchedFields: ['whatever', 'keyword'], matchedTerms: ['字幕'] },
    '字幕翻译',
  );
  assert.equal(r.line, '因为命中关键词：字幕');
  assert.ok(!r.line.includes('whatever'));
});
