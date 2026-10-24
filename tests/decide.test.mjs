/**
 * `/decide`（帮我选）的纯函数回归。
 *
 * 这一页是全站唯一「替用户做决定」的地方，所以这里测的不是渲染，而是
 * **决定的规矩**：预算档的边界、平台组的语义（网页版算不算能用）、排序是否
 * 稳定、空结果会不会给出口、反推荐会不会和推荐撞车。这些规则一旦漂移，
 * 页面上不会报错，只会悄悄给出错误的建议 —— 那比没有这一页更糟。
 *
 *   node --test tests/decide.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DECIDE_DEFAULTS,
  DECIDE_TASKS,
  buildDecideQuery,
  compareHref,
  countByTask,
  dayFromISO,
  decide,
  matchesBudget,
  matchesPlatform,
  parseDecideParams,
} from '../src/lib/decide.ts';

const CATEGORIES = JSON.parse(readFileSync(join(process.cwd(), 'data', 'categories.json'), 'utf8'));
const SLUGS = new Set(CATEGORIES.map((c) => c.slug));

/** 造一条候选：默认落在 `ai-video-animation`、免费增值、Web。 */
function entry(over = {}) {
  return {
    name: 'X',
    icon: '/assets/icons/x.png',
    cats: ['ai-video-animation'],
    tags: [],
    price: 'freemium',
    platforms: ['Web'],
    bestFor: ['剪短视频'],
    notFor: ['长片剪辑'],
    confidence: 'editor',
    order: 100,
    ...over,
  };
}

function table(list) {
  return Object.fromEntries(list.map(([slug, e]) => [slug, e]));
}

test('16 个任务都指向真实存在的分类 slug', () => {
  assert.equal(DECIDE_TASKS.length, 16);
  const ids = new Set();
  for (const task of DECIDE_TASKS) {
    assert.ok(!ids.has(task.id), `任务 id 重复：${task.id}`);
    ids.add(task.id);
    assert.ok(SLUGS.has(task.category), `任务 ${task.id} 的分类 ${task.category} 不在 categories.json`);
  }
});

test('预算档：完全免费不含免费增值，免费增值要「有免费额度」才放行', () => {
  assert.equal(matchesBudget('fully-free', 'free'), true);
  assert.equal(matchesBudget('open-source', 'free'), true);
  assert.equal(matchesBudget('freemium', 'free'), false, 'freemium 不属于「完全免费」');
  assert.equal(matchesBudget('freemium', 'free-tier'), true);
  assert.equal(matchesBudget('paid', 'free-tier'), false);
  assert.equal(matchesBudget('paid', 'any'), true);
  assert.equal(matchesBudget('unrated', 'free'), false, '未采集不等于免费');
});

test('平台组：网页版算「能用」，iOS 不因 iPadOS 缺失而被误杀', () => {
  assert.equal(matchesPlatform(['Web'], 'mac'), true, '只有网页版也算 Mac 上能用');
  assert.equal(matchesPlatform(['Web'], 'android'), true);
  assert.equal(matchesPlatform(['iPadOS'], 'ios'), true);
  assert.equal(matchesPlatform(['Mac'], 'ios'), false);
  assert.equal(matchesPlatform(['iOS'], 'android'), false);
  assert.equal(matchesPlatform([], 'any'), true);
  // 「电脑网页」不接受只在手机上的工具。
  assert.equal(matchesPlatform(['iOS', 'Android'], 'web'), false);
});

test('decide：没选任务就不推荐（宁可空着）', () => {
  const entries = table([['a', entry()]]);
  const r = decide(entries, { ...DECIDE_DEFAULTS }, { basisDay: dayFromISO('2026-10-22') });
  assert.equal(r.task, null);
  assert.deepEqual(r.picks, []);
  assert.equal(r.empty, false);
});

test('decide：硬筛后最多 3 个、不重复，反推荐不与推荐撞车', () => {
  const entries = table([
    ['cheap-web', entry({ name: 'A', order: 1 })],
    ['cheap-web2', entry({ name: 'B', order: 2 })],
    ['cheap-web3', entry({ name: 'C', order: 3 })],
    ['cheap-web4', entry({ name: 'D', order: 4 })],
    ['paid-only', entry({ name: 'E', order: 5, price: 'paid' })],
    ['ios-only', entry({ name: 'F', order: 6, platforms: ['iOS'] })],
    ['other-cat', entry({ name: 'G', order: 7, cats: ['ai-coding'] })],
  ]);
  const r = decide(
    entries,
    { task: 'video', budget: 'free-tier', plat: 'web', taste: 'any' },
    { basisDay: dayFromISO('2026-10-22') },
  );

  assert.equal(r.inCategory, 6, '同分类 6 个（other-cat 不算）');
  assert.equal(r.matched, 4, '4 个通过硬筛');
  assert.equal(r.picks.length, 3);
  assert.equal(new Set(r.picks.map((p) => p.slug)).size, 3, '推荐不重复');

  const pickSlugs = new Set(r.picks.map((p) => p.slug));
  for (const rej of r.rejects) {
    assert.ok(!pickSlugs.has(rej.slug), '反推荐不能同时出现在推荐里');
    assert.ok(rej.reasons.length > 0, '反推荐必须写明真实原因');
  }
  assert.ok(r.rejects.some((x) => x.slug === 'paid-only'), '付费工具应出现在「没选它」里');
});

test('decide：排序稳定（同一输入两次同序）且目录排位参与排序', () => {
  const entries = table([
    ['far', entry({ name: 'Far', order: 1800 })],
    ['near', entry({ name: 'Near', order: 10 })],
  ]);
  const prefs = { task: 'video', budget: 'any', plat: 'any', taste: 'any' };
  const a = decide(entries, prefs, { basisDay: dayFromISO('2026-10-22') });
  const b = decide(entries, prefs, { basisDay: dayFromISO('2026-10-22') });
  assert.deepEqual(
    a.picks.map((p) => p.slug),
    b.picks.map((p) => p.slug),
  );
  assert.equal(a.picks[0].slug, 'near', '同置信度下目录排位靠前的排第一');
});

test('decide：空结果时给出可放宽的出口', () => {
  const entries = table([
    // 两条各挂一条硬筛：放宽预算（free → free-tier）能救前者，不限平台能救后者。
    ['trial-web', entry({ price: 'freemium', platforms: ['Web'] })],
    ['free-mac', entry({ price: 'fully-free', platforms: ['Mac'] })],
  ]);
  const r = decide(
    entries,
    { task: 'video', budget: 'free', plat: 'web', taste: 'any' },
    { basisDay: dayFromISO('2026-10-22') },
  );
  assert.equal(r.picks.length, 0);
  assert.equal(r.empty, true);
  assert.equal(r.relaxable.budget, true, '放宽预算后会有结果');
  assert.equal(r.relaxable.platform, true, '不限平台后会有结果');
});

test('countByTask：按分类统计有判断的条数', () => {
  const counts = countByTask(
    table([
      ['a', entry()],
      ['b', entry({ cats: ['ai-video-animation', 'ai-agents'] })],
      ['c', entry({ cats: ['ai-coding'] })],
    ]),
  );
  assert.equal(counts.video, 2);
  assert.equal(counts.agent, 1);
  assert.equal(counts.code, 1);
  assert.equal(counts.law, 0);
});

test('URL：默认值不写进查询串，脏值落回默认', () => {
  assert.equal(buildDecideQuery(DECIDE_DEFAULTS), '');
  const qs = buildDecideQuery({ task: 'video', budget: 'free', plat: 'mac', taste: 'editor' });
  assert.equal(qs, '?task=video&budget=free&plat=mac&taste=editor');
  assert.deepEqual(parseDecideParams(qs), {
    task: 'video',
    budget: 'free',
    plat: 'mac',
    taste: 'editor',
  });
  // 手改 URL 的脏值不该炸，也不该被当成合法条件。
  assert.deepEqual(parseDecideParams('?task=nope&budget=cheap&plat=beos&taste=zzz'), DECIDE_DEFAULTS);
  assert.deepEqual(parseDecideParams(''), DECIDE_DEFAULTS);
});

test('对比链接：只有真的生成了 /compare 页面才给出口', () => {
  const entries = table([
    ['a', entry({ name: 'Alpha', vs: 'b', order: 1 })],
    ['b', entry({ name: 'Beta', vs: 'a', order: 2 })],
    ['same1', entry({ name: 'Kling AI', vs: 'same2', order: 3 })],
    ['same2', entry({ name: 'Kling', vs: 'same1', order: 4 })],
  ]);
  assert.equal(compareHref('a', entries), '/compare/a-vs-b');
  // 同一产品的两个收录条目：`/compare` 的语义闸门会挡掉，这里也必须挡。
  assert.equal(compareHref('same1', entries), null);
  assert.equal(compareHref('missing', entries), null);
});

test('真实数据冒烟：363 条判断能被 decide 消费，且每个任务都有候选', () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'data', 'verdict-index.json'), 'utf8'));
  const entries = raw.items;
  assert.equal(raw.count, Object.keys(entries).length);

  const basis = dayFromISO(raw.generatedAt);
  for (const task of DECIDE_TASKS) {
    const r = decide(entries, { task: task.id, budget: 'any', plat: 'any', taste: 'any' }, { basisDay: basis });
    assert.ok(r.inCategory >= 3, `${task.id} 只有 ${r.inCategory} 个候选，任务表与分类可能对不上`);
    assert.equal(r.picks.length, 3, `${task.id} 应能给出 3 个候选`);
    for (const p of r.picks) {
      const e = p.entry;
      assert.ok(e.name && e.icon, '候选必须能渲染出名字与图标');
      assert.ok(e.bestFor.length > 0, '候选必须有「适合」');
    }
  }
});

test('decide：主分类命中的排在「只是挂靠这一类」的前面', () => {
  // 造两个分数几乎一样的候选：一个主业是视频、一个主业是聊天只是顺带挂了视频。
  const entries = table([
    ['chat-first', entry({ name: '聊天为主', cats: ['ai-chatbots', 'ai-video-animation'], order: 1 })],
    ['video-first', entry({ name: '视频为主', cats: ['ai-video-animation'], order: 900 })],
  ]);
  const r = decide(
    entries,
    { task: 'video', budget: 'any', plat: 'any', taste: 'any' },
    { basisDay: dayFromISO('2026-10-22') },
  );
  assert.equal(r.picks[0].slug, 'video-first', '主分类命中应压过目录排位更靠前的挂靠条目');
});
