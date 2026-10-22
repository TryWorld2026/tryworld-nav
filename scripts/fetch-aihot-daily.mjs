#!/usr/bin/env node
/**
 * 抓取 AIHOT 的日报 / 周报 / 月报 / 热点榜，写入 `data/aihot-daily.json`。
 *
 * 和 `fetch-aihot.mjs`（抓资讯卡片流）分开，因为两者更新节奏不同：资讯条目
 * 一天里持续流入，日报每天 08:00 出刊一次、周报每周一、月报每月 1 日。这个
 * 脚本是**增量**的 —— 已经落盘的某一天/某一期不会重复请求，所以日常构建只
 * 花基础请求（归档列表 + 周报列表 + 月报列表 + 热点榜），再为热点 Top 10
 * 最多补 10 个事件详情请求；首次构建才会把 179 期日报全部取回。
 *
 * 接口：`https://aihot.news/api/v1`
 *   GET /dailies?limit=180        归档列表（只有标题与导语）
 *   GET /dailies/{date}           某一期完整日报（正文）
 *   GET /weeklies?limit=…         周报列表
 *   GET /weeklies/{week}          某一期周报正文
 *   GET /monthlies?limit=…        月报列表
 *   GET /monthlies/{month}        某一期月报正文
 *   GET /hot-topics               当前热点 Top 10
 *   GET /stories/{publicId}       当前热点的事件详情与多来源时间线
 *
 * 合规：AIHOT《公开使用规则》要求保留来源与 canonical 信息。原始响应的
 * `links.original`（原文）与 `links.aihot`（AIHOT 条目页）全部原样保留，页面
 * 上逐条展示来源站名，页脚给 AIHOT 出处。本项目定位非商业，属规则第 3 条
 * 「可以直接免费使用」。
 *
 * 失败策略：网络失败时保留上一版数据并 exit 0（只警告），只有在既抓不到又
 * 没有任何历史数据时才 exit 1。与 fetch-aihot.mjs 一致，断网不阻塞构建。
 *
 * 用法：
 *   node scripts/fetch-aihot-daily.mjs            # 增量
 *   node scripts/fetch-aihot-daily.mjs --force    # 全部重抓（约 200 个请求）
 *   AIHOT_API_BASE=… node scripts/fetch-aihot-daily.mjs   # 测试降级路径
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { writeAtomicSync } from './atomic-write.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapStory, slimLinks, storyIdFromUrl } from './aihot-story.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'data', 'aihot-daily.json');
const STORIES_OUT_PATH = join(ROOT, 'data', 'aihot-stories.json');

const API_BASE = (process.env.AIHOT_API_BASE ?? 'https://aihot.news/api/v1').replace(/\/+$/, '');
const UA = 'aihot-api/2.0.0 aihot-actor/tryworld-nav';
const FORCE = process.argv.includes('--force');

/** 日报归档上限。v1 接口 limit 的合法区间是 1..180，AIHOT 目前共 179 期。 */
const DAILY_LIMIT = 180;
const WEEKLY_LIMIT = 20;
const MONTHLY_LIMIT = 12;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET 一个 v1 端点，返回 JSON；失败抛错。
 *
 * 429 读 Retry-After 等一次；5xx 退避重试两次。超时 30 秒 —— AIHOT 的响应
 * 通常在 200–600 ms，30 秒已经足够宽。
 */
async function getJson(path) {
  const url = `${API_BASE}${path}`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Encoding': 'gzip, br' },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429) {
        const wait = Math.min(Number.parseInt(res.headers.get('retry-after') ?? '5', 10) || 5, 30);
        console.warn(`  429 限流，等 ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      if (res.status >= 500) {
        const ms = 1000 * 2 ** attempt;
        console.warn(`  ${res.status}，${ms}ms 后重试`);
        await sleep(ms);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${path} → HTTP ${res.status} ${body.slice(0, 120)}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr ?? new Error(`${path} 请求失败`);
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/** 日报正文 → 落盘形状。字段缺失时降级为空数组而不是抛错。 */
function slimDaily(report) {
  if (!report || !report.date) return null;
  return {
    date: String(report.date),
    generatedAt: report.generatedAt ?? null,
    windowStart: report.windowStart ?? null,
    windowEnd: report.windowEnd ?? null,
    link: report.links?.aihot ?? null,
    attribution: report.attribution ?? { name: 'AIHOT', url: report.links?.aihot ?? 'https://aihot.news' },
    lead:
      report.lead && report.lead.title
        ? {
            title: String(report.lead.title),
            leadParagraph: String(report.lead.leadParagraph ?? ''),
          }
        : null,
    sections: (Array.isArray(report.sections) ? report.sections : [])
      .map((s) => ({
        label: String(s?.label ?? '未分类'),
        items: (Array.isArray(s?.items) ? s.items : [])
          .map((it) => {
            const links = slimLinks(it?.links);
            if (!it?.title || !links) return null;
            return {
              title: String(it.title),
              summary: String(it.summary ?? ''),
              source: String(it?.source?.name ?? '未知来源'),
              links,
            };
          })
          .filter(Boolean),
      }))
      .filter((s) => s.items.length > 0),
    flashes: (Array.isArray(report.flashes) ? report.flashes : [])
      .map((it) => {
        const links = slimLinks(it?.links);
        if (!it?.title || !links) return null;
        return {
          title: String(it.title),
          source: String(it?.source?.name ?? '未知来源'),
          publishedAt: it.publishedAt ?? null,
          links,
        };
      })
      .filter(Boolean),
  };
}

/** 周报/月报正文 → 落盘形状。`key` 是 week 或 month。 */
function slimPeriod(report, key) {
  if (!report || !report[key]) return null;
  return {
    [key]: String(report[key]),
    periodStart: report.periodStart ?? null,
    periodEnd: report.periodEnd ?? null,
    generatedAt: report.generatedAt ?? null,
    link: report.links?.aihot ?? null,
    attribution: report.attribution ?? { name: 'AIHOT', url: report.links?.aihot ?? 'https://aihot.news' },
    headline: report.headline ?? null,
    overview: report.overview ?? null,
    sections: (Array.isArray(report.sections) ? report.sections : [])
      .map((s) => ({
        label: String(s?.label ?? '未分类'),
        summary: s?.summary ?? null,
        items: (Array.isArray(s?.items) ? s.items : [])
          .map((it) => {
            const links = slimLinks(it?.links);
            if (!it?.title || !links) return null;
            return {
              title: String(it.title),
              summary: String(it.summary ?? ''),
              source: String(it?.source?.name ?? '未知来源'),
              publishedAt: it.publishedAt ?? null,
              links,
            };
          })
          .filter(Boolean),
      }))
      .filter((s) => s.items.length > 0),
  };
}

/** 归档列表条目（只有导语，没有正文）。 */
function slimEntry(entry, key) {
  if (!entry || !entry[key]) return null;
  return {
    [key]: String(entry[key]),
    generatedAt: entry.generatedAt ?? null,
    leadTitle: entry.leadTitle ?? entry.headline ?? null,
    leadParagraph: entry.leadParagraph ?? entry.overview ?? null,
    link: entry.links?.aihot ?? null,
  };
}

async function main() {
  const existing = readJson(OUT_PATH, null);
  const prev = existing && typeof existing === 'object' ? existing : {};
  const prevDays = prev.days && typeof prev.days === 'object' ? prev.days : {};
  const prevWeeks = prev.weeks && typeof prev.weeks === 'object' ? prev.weeks : {};
  const prevMonths = prev.months && typeof prev.months === 'object' ? prev.months : {};
  const prevStoriesData = readJson(STORIES_OUT_PATH, null);
  const prevStories = new Map();
  if (prevStoriesData?.stories && typeof prevStoriesData.stories === 'object') {
    for (const [key, value] of Object.entries(prevStoriesData.stories)) {
      if (!value || typeof value !== 'object') continue;
      const id = storyIdFromUrl(key) ?? storyIdFromUrl(value.publicId);
      if (id) prevStories.set(id, value);
    }
  }

  console.log(`AIHOT 日报抓取：${API_BASE}`);

  // ---- 1. 归档列表（同时是日报的唯一真源：只渲染列表里存在的日期） ----
  let archive;
  try {
    const res = await getJson(`/dailies?limit=${DAILY_LIMIT}`);
    archive = (Array.isArray(res.items) ? res.items : [])
      .map((e) => slimEntry(e, 'date'))
      .filter(Boolean);
  } catch (err) {
    return degrade(`归档列表抓取失败：${err.message}`, prev);
  }
  if (archive.length === 0) return degrade('归档列表为空', prev);
  console.log(`  归档 ${archive.length} 期：${archive[archive.length - 1].date} … ${archive[0].date}`);

  // ---- 2. 逐期抓正文（增量） ----
  const days = {};
  let fetched = 0;
  let reused = 0;
  for (const entry of archive) {
    const date = entry.date;
    if (!FORCE && prevDays[date]) {
      days[date] = prevDays[date];
      reused++;
      continue;
    }
    try {
      const res = await getJson(`/dailies/${encodeURIComponent(date)}`);
      const slim = slimDaily(res.report);
      if (slim) {
        days[date] = slim;
        fetched++;
      }
    } catch (err) {
      console.warn(`  ${date} 抓取失败（${err.message}），跳过`);
      if (prevDays[date]) days[date] = prevDays[date];
    }
    await sleep(120); // 官方要求按节奏取，不并发猛拉
  }
  console.log(`  日报正文：新抓 ${fetched} 期，复用 ${reused} 期`);

  // ---- 3. 周报 ----
  const weeks = {};
  try {
    const res = await getJson(`/weeklies?limit=${WEEKLY_LIMIT}`);
    const list = (Array.isArray(res.items) ? res.items : []).map((e) => slimEntry(e, 'week')).filter(Boolean);
    for (const entry of list) {
      const key = entry.week;
      if (!FORCE && prevWeeks[key]) {
        weeks[key] = prevWeeks[key];
        continue;
      }
      try {
        const detail = await getJson(`/weeklies/${encodeURIComponent(key)}`);
        const slim = slimPeriod(detail.report, 'week');
        if (slim) weeks[key] = slim;
      } catch (err) {
        console.warn(`  周报 ${key} 抓取失败（${err.message}）`);
        if (prevWeeks[key]) weeks[key] = prevWeeks[key];
      }
      await sleep(120);
    }
    console.log(`  周报 ${Object.keys(weeks).length} 期`);
  } catch (err) {
    console.warn(`  周报列表失败（${err.message}），沿用上一版`);
    Object.assign(weeks, prevWeeks);
  }

  // ---- 4. 月报 ----
  const months = {};
  try {
    const res = await getJson(`/monthlies?limit=${MONTHLY_LIMIT}`);
    const list = (Array.isArray(res.items) ? res.items : []).map((e) => slimEntry(e, 'month')).filter(Boolean);
    for (const entry of list) {
      const key = entry.month;
      if (!FORCE && prevMonths[key]) {
        months[key] = prevMonths[key];
        continue;
      }
      try {
        const detail = await getJson(`/monthlies/${encodeURIComponent(key)}`);
        const slim = slimPeriod(detail.report, 'month');
        if (slim) months[key] = slim;
      } catch (err) {
        console.warn(`  月报 ${key} 抓取失败（${err.message}）`);
        if (prevMonths[key]) months[key] = prevMonths[key];
      }
      await sleep(120);
    }
    console.log(`  月报 ${Object.keys(months).length} 期`);
  } catch (err) {
    console.warn(`  月报列表失败（${err.message}），沿用上一版`);
    Object.assign(months, prevMonths);
  }

  // ---- 5. 热点榜（每次都刷，10 条，很便宜） ----
  let hot = Array.isArray(prev.hot) ? prev.hot : [];
  let hotListAvailable = false;
  let storyIds = [];
  try {
    const res = await getJson('/hot-topics');
    const list = (Array.isArray(res.items) ? res.items : [])
      .slice(0, 10)
      .map((it) => {
        const links = slimLinks(it?.links);
        if (!it?.title || !links) return null;
        return {
          rank: Number(it.rank) || 0,
          id: String(it.id ?? ''),
          title: String(it.title),
          source: String(it?.source?.name ?? '未知来源'),
          sourceCount: Number(it.sourceCount) || 0,
          signalCount: Number(it.signalCount) || 0,
          participantCount: Number(it.participantCount) || 0,
          sourceNames: Array.isArray(it.sourceNames) ? it.sourceNames.map(String).slice(0, 12) : [],
          latestAt: it.latestAt ?? null,
          links,
        };
      })
      .filter(Boolean);
    hotListAvailable = list.length > 0;
    if (hotListAvailable) {
      hot = list;
      storyIds = [
        ...new Set(
          list
            .map((item) => storyIdFromUrl(item.links?.story))
            .filter(Boolean),
        ),
      ].slice(0, 10);
    }
    console.log(`  热点 ${list.length} 条`);
  } catch (err) {
    console.warn(`  热点榜抓取失败（${err.message}），沿用上一版 ${hot.length} 条`);
  }

  // ---- 6. 当前热点对应的事件详情（只保留本轮 Top 10，不落历史） ----
  let storiesFetched = false;
  if (hotListAvailable) {
    const stories = {};
    for (const id of storyIds) {
      try {
        const payload = await getJson(`/stories/${encodeURIComponent(id)}`);
        const story = mapStory(payload);
        if (!story || story.publicId !== id) {
          throw new Error('响应缺少有效的事件 publicId 或标题');
        }
        stories[id] = story;
      } catch (err) {
        const previous = prevStories.get(id);
        if (previous) {
          stories[id] = previous;
          console.warn(`  事件 ${id} 抓取失败（${err.message}），复用旧数据`);
        } else {
          console.warn(`  事件 ${id} 抓取失败（${err.message}），本轮跳过`);
        }
      }
      await sleep(120);
    }
    const storyPayload = {
      source: 'AIHOT',
      api: 'https://aihot.news/api/v1',
      fetchedAt: new Date().toISOString(),
      stories,
    };
    mkdirSync(dirname(STORIES_OUT_PATH), { recursive: true });
    writeAtomicSync(STORIES_OUT_PATH, `${JSON.stringify(storyPayload)}\n`);
    storiesFetched = true;
    console.log(`  事件详情：${storyIds.length} 个 ID，写入 ${Object.keys(stories).length} 个事件`);
  } else {
    console.warn('  热点榜不可用（请求失败或为空），保留现有事件详情数据');
  }

  const dayCount = Object.keys(days).length;
  if (dayCount === 0) return degrade('日报正文 0 期', prev);

  const payload = {
    source: 'AIHOT',
    api: 'https://aihot.news/api/v1',
    fetchedAt: new Date().toISOString(),
    archive,
    days,
    weeks,
    months,
    hot,
    counts: { days: dayCount, weeks: Object.keys(weeks).length, months: Object.keys(months).length, hot: hot.length },
  };

  // 原子写：先写临时文件再 rename，避免构建中途读到半截 JSON。
  // rename 在 Windows 上会被正在扫描/打开目标的进程以 EPERM 拒掉，
  // 所以走 `writeAtomicSync`（内部重试），见 scripts/atomic-write.mjs。
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeAtomicSync(OUT_PATH, `${JSON.stringify(payload)}\n`);

  const size = (JSON.stringify(payload).length / 1024 / 1024).toFixed(1);
  console.log(`  写入 ${OUT_PATH}（${size} MB）`);
  console.log(`  日报 ${dayCount} 期 / 周报 ${Object.keys(weeks).length} 期 / 月报 ${Object.keys(months).length} 期 / 热点 ${hot.length} 条`);
  if (storiesFetched) console.log(`  事件详情 ${Object.keys(readJson(STORIES_OUT_PATH, {}).stories ?? {}).length} 个`);
  return 0;
}

/** 抓不到时：有历史数据就警告放行，没有才失败。 */
function degrade(reason, prev) {
  const days = prev?.days && typeof prev.days === 'object' ? Object.keys(prev.days).length : 0;
  if (days > 0) {
    console.warn(`⚠ 抓取失败：${reason}`);
    console.warn(`  保留现有 ${days} 期日报继续构建`);
    return 0;
  }
  console.error(`✗ 抓取失败且没有历史数据：${reason}`);
  console.error('  data/aihot-daily.json 不存在，日报页面会是空的。先联网跑一次本脚本。');
  return 1;
}

const code = await main();
process.exit(code);
