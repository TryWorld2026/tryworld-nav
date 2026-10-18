/**
 * 日报 / 周报 / 月报纯函数的测试。
 *
 * 和 `news.test.mjs` 同样的理由：这些函数里最容易悄悄出错的是**日期口径**。
 * AIHOT 的 `date` 是北京日历日，`generatedAt` 是 UTC；一旦有人对日期字符串
 * 调 `new Date()` 再 `.toISOString()`，整月归档就会在某几个时区下错位一天，
 * 而页面上只是「某期不见了」，肉眼几乎发现不了。
 *
 * 全部用 `node --test`，无依赖；Node 24 直接 import `.ts`（类型剥离）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateKey,
  weekdayZh,
  formatDateFull,
  formatDateShort,
  formatMonth,
  dayGap,
  shiftDate,
  beijingTime,
  dailyStats,
  numberedSections,
  highlights,
  leadLinks,
  leadSource,
  issueNumber,
  dailyNeighbors,
  dailyPager,
  archiveGroups,
  monthCalendar,
  formatWeek,
  formatPeriodRange,
  periodStats,
  hotBarWidth,
} from '../src/lib/news-period.ts';

/* ------------------------------------------------------------------ */
/* 日期                                                                */
/* ------------------------------------------------------------------ */

test('parseDateKey 拆字符串，不经过时区', () => {
  assert.deepEqual(parseDateKey('2026-10-17'), { y: 2026, m: 10, d: 17 });
  // 非法日期必须拒绝，而不是滚到下个月
  assert.equal(parseDateKey('2026-02-31'), null);
  assert.equal(parseDateKey('2026-13-01'), null);
  assert.equal(parseDateKey(''), null);
  assert.equal(parseDateKey(null), null);
  // 带时间的 ISO 串也能取到日期部分（归档里不会出现，但防御）
  assert.deepEqual(parseDateKey('2026-10-17T23:00:00Z'), { y: 2026, m: 10, d: 17 });
});

test('weekdayZh 按 UTC 计算，不受本机时区影响', () => {
  // 2026-10-17 是星期六
  assert.equal(weekdayZh('2026-10-17'), '周六');
  assert.equal(weekdayZh('2026-10-18'), '周日');
  assert.equal(weekdayZh('2026-10-19'), '周一');
  assert.equal(weekdayZh('bad'), '');
});

test('格式化函数输出中文日期', () => {
  assert.equal(formatDateFull('2026-10-17'), '2026 年 10 月 17 日');
  assert.equal(formatDateShort('2026-10-07'), '10 月 7 日');
  assert.equal(formatMonth('2026-10'), '2026 年 10 月');
  assert.equal(formatMonth('2026-1'), '');
});

test('dayGap 与 shiftDate 跨月跨年正确', () => {
  assert.equal(dayGap('2026-10-15', '2026-10-17'), 2);
  assert.equal(dayGap('2026-09-30', '2026-10-01'), 1);
  assert.equal(dayGap('2025-12-31', '2026-01-01'), 1);
  assert.equal(shiftDate('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('bad', 1), '');
});

test('beijingTime 把 UTC 转成北京时间', () => {
  assert.equal(beijingTime('2026-10-17T00:22:42.000Z'), '08:22');
  assert.equal(beijingTime('2026-10-16T16:00:00.000Z'), '00:00');
  assert.equal(beijingTime(null), '');
  assert.equal(beijingTime('nope'), '');
});

/* ------------------------------------------------------------------ */
/* 日报                                                                */
/* ------------------------------------------------------------------ */

const report = {
  date: '2026-10-17',
  generatedAt: '2026-10-17T00:00:28.429Z',
  windowStart: null,
  windowEnd: null,
  link: 'https://aihot.news/daily/2026-10-17',
  lead: { title: '头条标题', leadParagraph: '头条导语。' },
  sections: [
    {
      label: '模型发布/更新',
      items: [
        { title: '头条标题', summary: '摘要一', source: '来源 A', links: { original: 'https://a.example/1' } },
        { title: '第二条', summary: '摘要二', source: '来源 B', links: { original: 'https://b.example/2' } },
      ],
    },
    {
      label: '行业动态',
      items: [{ title: '第三条', summary: '', source: '来源 A', links: { original: 'https://c.example/3' } }],
    },
  ],
  flashes: [
    { title: '快讯一', source: '来源 C', publishedAt: '2026-10-16T22:22:42.000Z', links: { original: 'https://d.example/4' } },
    { title: '快讯二', source: '来源 A', publishedAt: null, links: { original: 'https://e.example/5' } },
  ],
};

test('dailyStats 统计条目、去重来源、栏目与阅读时长', () => {
  const s = dailyStats(report);
  assert.equal(s.items, 5); // 3 正文 + 2 快讯
  assert.equal(s.sources, 3); // A/B/C
  assert.equal(s.sections, 2);
  assert.equal(s.flashes, 2);
  assert.ok(s.minutes >= 1, '阅读时长至少 1 分钟');
});

test('numberedSections 生成 01/02 与稳定锚点', () => {
  const s = numberedSections(report);
  assert.deepEqual(
    s.map((x) => [x.index, x.anchor, x.label, x.count]),
    [
      ['01', 's-1', '模型发布/更新', 2],
      ['02', 's-2', '行业动态', 1],
    ],
  );
});

test('highlights 取各栏目头条，不重复栏目', () => {
  const h = highlights(report, 3);
  assert.equal(h.length, 2); // 只有两个栏目
  assert.deepEqual(
    h.map((x) => x.title),
    ['头条标题', '第三条'],
  );
  assert.equal(h[0].anchor, 's-1');
  assert.equal(highlights(report, 1).length, 1);
});

test('leadLinks / leadSource 按标题回查条目；查不到返回 null', () => {
  assert.deepEqual(leadLinks(report), { original: 'https://a.example/1' });
  assert.equal(leadSource(report), '来源 A');
  const orphan = { ...report, lead: { title: '编外头条', leadParagraph: '' } };
  assert.equal(leadLinks(orphan), null);
  assert.equal(leadSource(orphan), null);
  assert.equal(leadLinks({ ...report, lead: null }), null);
});

test('issueNumber 按归档顺序把日期换算成期号', () => {
  const archive = [
    { date: '2026-10-17' },
    { date: '2026-10-16' },
    { date: '2026-10-15' },
  ];
  assert.equal(issueNumber(archive, '2026-10-17'), 3);
  assert.equal(issueNumber(archive, '2026-10-15'), 1);
  assert.equal(issueNumber(archive, '2026-10-01'), 0);
});

test('dailyNeighbors 在倒序归档里给出前后一期', () => {
  const archive = [{ date: '2026-10-17' }, { date: '2026-10-16' }, { date: '2026-10-15' }];
  const n = dailyNeighbors(archive, '2026-10-16');
  assert.equal(n.prev.date, '2026-10-15');
  assert.equal(n.next.date, '2026-10-17');
  // 最新一期没有「下一期」，最早一期没有「上一期」
  assert.equal(dailyNeighbors(archive, '2026-10-17').next, null);
  assert.equal(dailyNeighbors(archive, '2026-10-15').prev, null);
});

test('dailyPager 把最近三期标成今天/昨天/日期，并给「更早」', () => {
  const archive = ['2026-10-17', '2026-10-16', '2026-10-15', '2026-10-14', '2026-10-13'].map(
    (date) => ({ date }),
  );
  const p = dailyPager(archive, '2026-10-17', '2026-10-17');
  assert.deepEqual(
    p.map((x) => x.label),
    ['今天', '昨天', '10 月 15 日', '更早'],
  );
  assert.equal(p[0].current, true);
  assert.equal(p[3].date, '2026-10-14');
});

/* ------------------------------------------------------------------ */
/* 归档与日历                                                          */
/* ------------------------------------------------------------------ */

test('archiveGroups 按月分组、组间倒序、组内保持传入顺序', () => {
  const archive = [
    { date: '2026-10-17' },
    { date: '2026-10-01' },
    { date: '2026-09-30' },
    { date: '2026-09-01' },
  ];
  const g = archiveGroups(archive);
  assert.deepEqual(
    g.map((x) => [x.key, x.days.length]),
    [
      ['2026-10', 2],
      ['2026-09', 2],
    ],
  );
  assert.equal(g[0].days[0].date, '2026-10-17');
});

test('monthCalendar 以周一开头，只把有出刊的日期标为可点', () => {
  const archive = [{ date: '2026-10-17' }, { date: '2026-10-03' }];
  const cal = monthCalendar('2026-10-17', archive);
  assert.ok(cal);
  assert.equal(cal.key, '2026-10');
  // 2026-10-01 是周四 → 前面空 3 格
  assert.equal(cal.cells.slice(0, 3).filter((c) => c === null).length, 3);
  const first14 = cal.cells.filter(Boolean);
  assert.equal(first14[0].day, 1);
  const has = first14.filter((c) => c.hasIssue).map((c) => c.date);
  assert.deepEqual(has.sort(), ['2026-10-03', '2026-10-17']);
  // 网格必须是整周
  assert.equal(cal.cells.length % 7, 0);
  // 10 月共 31 天
  assert.equal(first14.length, 31);
});

test('monthCalendar 跨年月份的前后月锚点', () => {
  const archive = [{ date: '2026-01-05' }, { date: '2025-12-20' }];
  const cal = monthCalendar('2026-01-05', archive);
  assert.equal(cal.prevMonthAnchor, '2025-12-20');
  const dec = monthCalendar('2025-12-20', archive);
  assert.equal(dec.prevMonthAnchor, null); // 11 月没有数据
  assert.equal(dec.nextMonthAnchor, '2026-01-05');
});

/* ------------------------------------------------------------------ */
/* 周报 / 月报                                                         */
/* ------------------------------------------------------------------ */

test('formatWeek / formatPeriodRange', () => {
  assert.equal(formatWeek('2026-W41'), '2026 年第 41 周');
  assert.equal(formatWeek('2026-W05'), '2026 年第 5 周');
  assert.equal(formatWeek('nope'), '');
  assert.equal(formatPeriodRange('2026-10-05', '2026-10-11'), '10 月 5 日 – 10 月 11 日');
  assert.equal(formatPeriodRange(null, '2026-10-11'), '');
});

test('periodStats 跨栏目拍平后统计', () => {
  const r = {
    week: '2026-W41',
    periodStart: '2026-10-05',
    periodEnd: '2026-10-11',
    generatedAt: null,
    link: null,
    headline: '头条',
    overview: null,
    sections: [
      {
        label: 'A',
        summary: null,
        items: [
          { title: 't1', summary: 's1', source: 'S1', links: { original: 'u1' }, publishedAt: null },
          { title: 't2', summary: 's2', source: 'S2', links: { original: 'u2' }, publishedAt: null },
        ],
      },
      {
        label: 'B',
        summary: null,
        items: [
          { title: 't3', summary: 's3', source: 'S1', links: { original: 'u3' }, publishedAt: null },
        ],
      },
    ],
  };
  const s = periodStats(r);
  assert.equal(s.items, 3);
  assert.equal(s.sources, 2);
  assert.equal(s.sections, 2);
  assert.ok(s.minutes >= 1);
});

/* ------------------------------------------------------------------ */
/* 热点榜                                                              */
/* ------------------------------------------------------------------ */

test('hotBarWidth 相对榜首归一化，最小 12%，空指标回退等宽', () => {
  const topics = [
    { rank: 1, id: 'a', title: 'a', source: 's', sourceCount: 10, signalCount: 100, participantCount: 0, sourceNames: [], latestAt: null, links: {} },
    { rank: 2, id: 'b', title: 'b', source: 's', sourceCount: 5, signalCount: 25, participantCount: 0, sourceNames: [], latestAt: null, links: {} },
    { rank: 3, id: 'c', title: 'c', source: 's', sourceCount: 0, signalCount: 0, participantCount: 0, sourceNames: [], latestAt: null, links: {} },
  ];
  assert.equal(hotBarWidth(topics[0], topics), 100);
  assert.equal(hotBarWidth(topics[1], topics), 25);
  // 全零的条目拿最小宽度，不渲染成 0（那样看起来像坏掉了）
  assert.equal(hotBarWidth(topics[2], topics), 12);
});
