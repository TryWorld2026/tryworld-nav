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
 * 2026-10-22：`data/search-index.json` 改成了 v2 的**紧凑 wire 格式**
 * （`{v:2, cats, tags, kw, pl, rows}`，行是定长位置元组，398 KB → 221 KB raw）。
 * 所以这里不能把 JSON 直接当 `SearchRecord[]` 用 —— 必须先过
 * `decodeSearchIndex()`，它会把字典下标、bitmask、扩展名字母还原成
 * 读者能用的字段。少这一步测试就会拿到一堆数字（`c`/`t` 是下标、`p` 是
 * 价格码数字、`pl` 是平台 bitmask），断言会以非常难读的方式失败。
 *
 *   node --test tests/search.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  compoundParts,
  decodeSearchIndex,
  expandQuery,
  filterRecords,
  searchIndex,
  sortRecords,
  INTENTS,
  LEXICON,
  PRICE_CODES,
} from '../src/lib/search.ts';

const WIRE = JSON.parse(readFileSync(join(process.cwd(), 'data', 'search-index.json'), 'utf8'));
const INDEX = decodeSearchIndex(WIRE);

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

test('wire 是 v2 紧凑格式，且能解码成 2081 条记录', () => {
  assert.equal(WIRE.v, 2, '索引必须是 v2 wire 格式');
  assert.equal(INDEX.length, 2081, '解码后的条目数应与工具总数一致');
});

test('22 个真实意图词全部至少命中 1 条', () => {
  const misses = [];
  for (const q of INTENT_QUERIES) {
    const hits = searchIndex(INDEX, q, 30);
    if (hits.length === 0) misses.push(q);
  }
  assert.deepEqual(misses, [], `这些意图词仍然 0 命中：${misses.join('、')}`);
});

/**
 * 2026-10-19 对抗式审查发现的零命中词。
 *
 * 为什么单独列一张表：它们是同一类缺陷的不同形态 —— 用户用「动词+名词」的
 * 自然说法搜索，而 `INTENTS` 只做**整串**匹配、索引关键词里只有名词本身。
 * 「剪视频」整串不是任何意图键，「画图」在索引里一个字都没有，于是都 0 结果，
 * 而站内分别有 152 个剪辑类、12 个绘画类工具。
 */
const COLLOQUIAL_QUERIES = ['剪视频', '做表格', '画图', '写小说', '做播客', '写邮件', '爬虫'];

test('口语化的「动词+名词」说法也必须命中（2026-10-19 审查发现）', () => {
  const misses = [];
  for (const q of COLLOQUIAL_QUERIES) {
    const hits = searchIndex(INDEX, q, 30);
    if (hits.length === 0) misses.push(q);
  }
  assert.deepEqual(misses, [], `这些口语说法仍然 0 命中：${misses.join('、')}`);
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

test('命中带可解释字段（读者能看懂「为什么这条排前面」）', () => {
  const [hit] = searchIndex(INDEX, '视频', 1);
  assert.ok(hit, '应有结果');
  assert.ok(Array.isArray(hit.matchedFields) && hit.matchedFields.length > 0, '应说明命中在哪些字段');
  assert.ok(hit.score > 0, '分数应为正数');
});

test('filterRecords：分类多选是并集，标签是精确匹配', () => {
  const onlyCoding = filterRecords(INDEX, { cats: ['ai-coding'] });
  assert.ok(onlyCoding.length > 0);
  assert.ok(onlyCoding.every((r) => r.c.includes('ai-coding')));

  const twoCats = filterRecords(INDEX, { cats: ['ai-coding', 'ai-writing'] });
  assert.ok(twoCats.length > onlyCoding.length, '两个分类应比一个分类宽（并集）');

  const tagged = filterRecords(INDEX, { tags: ['编辑推荐'] });
  assert.ok(tagged.every((r) => r.t.includes('编辑推荐')));
});

test('filterRecords：price=free 展开成「完全免费 + 开源」共 238 条', () => {
  // 历史口径：站内「免费」筛选一直是 免费(183) + 免费开源(55) = 238 条。
  // 价格现在进了索引（wire 第 8 槽），不再需要服务端传 freeSlugs 白名单。
  const free = filterRecords(INDEX, { price: 'free' });
  assert.equal(free.length, 238, '「免费」应展开为 fully-free + open-source');
  assert.ok(free.every((r) => r.p === 'fully-free' || r.p === 'open-source'));
});

test('filterRecords：平台筛选按 bitmask 解码后的名匹配', () => {
  const ios = filterRecords(INDEX, { platforms: ['iOS'] });
  assert.ok(ios.length > 0, '应有 iOS 工具');
  assert.ok(ios.every((r) => r.pl.includes('iOS')));
});

test('sortRecords：最近更新把没采集时间的稳定置后', () => {
  const sorted = sortRecords(INDEX, 'updated');
  assert.equal(sorted.length, INDEX.length);
  const firstMissing = sorted.findIndex((r) => typeof r.u !== 'number');
  if (firstMissing !== -1) {
    assert.ok(
      sorted.slice(firstMissing).every((r) => typeof r.u !== 'number'),
      '没采集更新时间的条目必须全部排在后面',
    );
  }
});

/**
 * 2026-10-22 实测的「任务型长词」缺陷（product-auditor 走查发现）。
 *
 * 守的是什么：首页定义句写着「按『你想做什么』分成 26 个场景」，搜索框
 * placeholder 写着「或直接说你想做什么…」—— 这是站点自己邀请用户做的事。
 * 而实测「公众号排版」59 条结果**全部同分 45**，排序完全由名字长度决定，
 * 简介原文写着「公众号智能文案与排版助手」的 `135editor-ai` **一条都不在
 * 结果里**。用户被明确邀请去做的事，做了拿到错误答案 —— 这比「还能更好」
 * 严重一档。
 *
 * 三个根因，每个都有独立用例守着：
 *   1. 中文复合词不拆 → `compoundParts` 拆成部件词，组内 OR
 *   2. 只命中部分部件与全部部件同分 → 部件覆盖率加成（`COVERAGE_BONUS`）
 *   3. 意图别名（文案/笔记/种草）压过用户原话 → 原词加权（`PRIMARY_FACTOR`）
 */
test('中文复合词被拆成部件词（compoundParts）', () => {
  assert.deepEqual(compoundParts('公众号排版'), ['公众号', '排版']);
  assert.deepEqual(compoundParts('小红书图文'), ['小红书', '图文']);
  // 单字/双字、拆不出两个部件的都不拆。
  assert.deepEqual(compoundParts('写作'), []);
  assert.deepEqual(compoundParts('视频剪辑'), []);
});

test('「公众号排版」的第一条必须是真正做公众号排版的工具', () => {
  // 这条用例的钉法很直接：135editor-ai 的简介原文就是「公众号智能文案与
  // 排版助手」，它必须排第一 —— 修复前它**根本不在 59 条结果里**。
  const hits = searchIndex(INDEX, '公众号排版', 200);
  assert.ok(hits.length > 0, '应有结果');
  assert.equal(
    hits[0].slug,
    '135editor-ai',
    `第一条应是 135 AI排版助手，实际是「${hits[0].slug}」`,
  );
});

test('「小红书图文」的第一条是图文创作工具，不是笔记工具', () => {
  const hits = searchIndex(INDEX, '小红书图文', 200);
  const top = INDEX.find((r) => r.s === hits[0]?.slug);
  assert.ok(top, '应有结果');
  // 01Agent 的简介是「专为内容创作者打造的AI图文创作智能体」。
  assert.ok(
    /图文|小红书|创作/.test(top.n + top.d),
    `第一条应贴图文创作，实际是「${top.n}」：${top.d}`,
  );
});

test('用户原话压过同义表别名（搜「小红书」不再被笔记工具淹没）', () => {
  // 修复前：别名「笔记」在简介里命中是 60×0.9=54，而原词「小红书」在关键词
  // 里只有 45 —— 前 4 条全是笔记工具。原词必须加权到别名之上。
  const hits = searchIndex(INDEX, '小红书', 200);
  const top = INDEX.find((r) => r.s === hits[0]?.slug);
  assert.ok(top, '应有结果');
  assert.ok(
    (top.k ?? []).includes('小红书') || top.d.includes('小红书'),
    `第一条自己应当提到小红书，实际是「${top.n}」：${top.d} / kw=${(top.k ?? []).join(',')}`,
  );
});

test('同分不再按名字长度排序（短名不是相关性信号）', () => {
  // 修复前「公众号排版」59 条全部同分，排序 = 名字长度 → 两字名「语构」
  // 「美洽」排前面。现在同分按目录序号稳定排序，与名字长度无关。
  const hits = searchIndex(INDEX, '公众号排版', 200);
  const names = hits.slice(0, 10).map((h) => INDEX.find((r) => r.s === h.slug)?.n ?? '');
  // 前 10 条里至少要有 3 条名字超过 4 个字 —— 若仍按名字长度排序，
  // 前 10 条会被两三个字的短名占满。
  const long = names.filter((n) => n.length > 4).length;
  assert.ok(long >= 3, `前 10 条里长名工具太少（${long} 条），排序可能又回到名字长度：${names.join(' / ')}`);
});

test('同时命中全部部件的结果，分数必须明显高于只命中一个部件的', () => {
  // 「公众号排版」拆成 ['公众号','排版']。135editor-ai 的简介同时出现这两个词
  // （覆盖率 2），而「蛙蛙写作」这类只提到「公众号」的工具覆盖率是 1。
  //
  // 断言的是**分差**而不只是名次：覆盖率加成若被调成 0，两者的名次可能
  // 因为目录序碰巧还对，但分数会只差 13.5（简介 30 × 0.9 vs 关键词 45 × 0.9），
  // 任何一条新数据都能翻盘。加成到位时差距 ≥ 30，这才是稳定的。
  const hits = searchIndex(INDEX, '公众号排版', 200);
  const full = hits.find((h) => h.slug === '135editor-ai');
  assert.ok(full, '135editor-ai 必须在结果里');
  const partial = hits.find((h) => h.score < full.score && h.score > 0);
  assert.ok(partial, '应有只命中部分部件的对照结果');
  assert.ok(
    full.score - partial.score >= 30,
    `命中全部部件的分差只有 ${(full.score - partial.score).toFixed(1)}，覆盖率加成可能失效了`,
  );
});

test('sortRecords：按名称用中文 collator（不是裸字符串比较）', () => {
  const sorted = sortRecords(INDEX.slice(0, 40), 'name');
  const collator = new Intl.Collator('zh-CN', { numeric: true });
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(collator.compare(sorted[i - 1].n, sorted[i].n) <= 0, '名称排序应单调不减');
  }
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
    assert.ok(Array.isArray(r.t), `${r.s} 的标签不是数组`);
    assert.ok(Array.isArray(r.pl), `${r.s} 的平台不是数组`);
    assert.ok(PRICE_CODES.includes(r.p), `${r.s} 的价格码非法：${r.p}`);
    assert.equal(typeof r.w, 'boolean', `${r.s} 的 hasExternal 必须是布尔`);
    assert.equal(typeof r.o, 'number', `${r.s} 的目录序号必须是数字`);
  }
});

test('解码后的价格分布与数据源一致（免费增值是多数派）', () => {
  const counts = new Map();
  for (const r of INDEX) counts.set(r.p, (counts.get(r.p) ?? 0) + 1);
  assert.equal(counts.get('freemium'), 1737, '免费增值应为 1737 条');
  assert.equal(counts.get('fully-free'), 183, '完全免费应为 183 条');
  assert.equal(counts.get('open-source'), 55, '免费开源应为 55 条');
  assert.equal(counts.get('paid'), 51, '付费应为 51 条');
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
