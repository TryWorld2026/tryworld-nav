#!/usr/bin/env node
/**
 * 抓取 AIHOT 精选条目，写入 `data/news.json`，供 /news 卡片流静态渲染。
 *
 * 为什么是构建期抓取而不是运行时调用：本站是 `output: 'export'` 的纯静态站，
 * 没有服务端，页面在构建时全部预渲染。所以资讯只能在构建前落成数据文件。
 * 这也正好对上 AIHOT 官方建议的取数节奏（资讯最快 1 分钟一次、日报每天
 * 08:00 后一次）——导航站没必要秒级同步。
 *
 * 接口用的是 **v1**（`https://aihot.news/api/v1`），不是旧的
 * `/api/public/*`：后者已于 2026-07-25 公告、**2026-10-31 停服**（原定
 * 12-31，已提前），旧域名 aihot.virxact.com 同日起只做 301 跳转。写这个脚本
 * 时（2026-10-15）离停服只剩 16 天，所以直接对齐 v1，不做旧接口兼容。
 *
 * 字段映射（v1 → 本文件写出的形状）：
 *   title            → title
 *   originalTitle    → originalTitle（英文原标题，仅在与 title 不同时存在）
 *   summary          → summary（AIHOT 的 LLM 中文摘要）
 *   source.name      → source
 *   links.original   → originalUrl   ← **必须保留**，卡片跳转目标
 *   links.aihot      → aihotUrl      ← **必须保留**，canonical 与署名
 *   attribution.url  → aihotUrl（兜底，与 links.aihot 同值）
 *   publishedAt      → publishedAt
 *   category         → category（英文 slug）+ categoryLabel（中文徽章）
 *   reason           → reason（AIHOT 的入选理由）
 *
 * 合规：AIHOT《公开使用规则》v1.1 要求保留机器响应里的来源与 canonical 信息、
 * 不得删除或伪造署名。本站为非商业用途（规则第 3 条「可以直接免费使用」），
 * 但仍照此保留 source / aihotUrl / originalUrl 三个字段并在 UI 上展示。
 * 规则第 7 条要求「撤回、删除、更正时尽快同步」——构建期整份重抓天然满足。
 *
 * 失败策略：网络不通、接口 5xx、字段缺失都**不让构建失败**。已有
 * `data/news.json` 时打印警告并 exit 0（用上次的数据继续构建）；只有在既抓不到
 * 又没有任何历史数据时才 exit 1。这样 CI 断网不会把站点构建搞挂。
 *
 * 用法：
 *   node scripts/fetch-aihot.mjs              # 增量：带 ETag，304 就不重写
 *   node scripts/fetch-aihot.mjs --force      # 忽略 ETag，强制重抓
 *   node scripts/fetch-aihot.mjs --max=300    # 覆盖条目上限（默认 240）
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEWS_PATH = join(ROOT, 'data', 'news.json');
const META_PATH = join(ROOT, 'data', 'aihot-meta.json');

/**
 * v1 只接受 OpenAPI 里声明且不重复的参数——旧客户端带的 `_` 防缓存参数或未知
 * 参数会直接 400。所以这里只出现 mode / window / limit / cursor 四个。
 *
 * `AIHOT_API_BASE` 可覆盖地址，只为测试降级路径用（指向一个不可达主机即可验证
 * 「抓不到时保留上一版」）；正常构建不要设它。
 */
const API_BASE = (process.env.AIHOT_API_BASE ?? 'https://aihot.news/api/v1').replace(/\/+$/, '');
const API = `${API_BASE}/items`;

/**
 * 官方建议的 UA 形态是 `aihot-api/<版本> aihot-actor/<匿名标识>`。那个标识按
 * 文档是「本机生成的匿名标识，只用来合并统计，不是账号或密钥」，所以这里用一个
 * 稳定字符串而不是每次随机——随机的话统计反而对不上。
 */
const UA = 'aihot-api/2.0.0 aihot-actor/tryworld-nav';

const FORCE = process.argv.includes('--force');
const MAX_ITEMS = (() => {
  const arg = process.argv.find((a) => a.startsWith('--max='));
  const n = arg ? Number.parseInt(arg.slice(6), 10) : 240;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 240;
})();

/** v1 的 category 取值集（比旧文档多一个 opinion）。 */
const CATEGORY_LABELS = {
  'ai-models': 'AI 模型',
  'ai-products': 'AI 产品',
  industry: '行业动态',
  paper: '论文',
  tip: '教程',
  opinion: '观点',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 带超时与退避的 GET。返回 `{ status, body, etag }`。
 *
 * 429 按官方要求读 Retry-After 等待，且**不并发重试**（本脚本本来就是串行的）。
 * 5xx 指数退避，最多两次。其余状态直接返回给调用方判断。
 */
async function getJson(url, { etag } = {}) {
  const headers = { 'User-Agent': UA, 'Accept-Encoding': 'gzip, br' };
  if (etag) headers['If-None-Match'] = etag;

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (res.status === 304) return { status: 304, body: null, etag };

      if (res.status === 429) {
        const wait = Number.parseInt(res.headers.get('retry-after') ?? '5', 10);
        const ms = Math.min(Number.isFinite(wait) ? wait * 1000 : 5000, 30_000);
        console.warn(`  429 限流，按 Retry-After 等 ${ms}ms 后重试`);
        await sleep(ms);
        continue;
      }
      if (res.status >= 500) {
        const ms = 1000 * 2 ** attempt;
        console.warn(`  ${res.status} 服务端错误，${ms}ms 后重试（第 ${attempt + 1} 次）`);
        await sleep(ms);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { status: res.status, body: text.slice(0, 300), etag: null };
      }
      return { status: 200, body: await res.json(), etag: res.headers.get('etag') };
    } catch (err) {
      lastErr = err;
      const ms = 1000 * 2 ** attempt;
      console.warn(`  请求失败（${err.name}），${ms}ms 后重试（第 ${attempt + 1} 次）`);
      await sleep(ms);
    }
  }
  throw lastErr ?? new Error('请求失败');
}

/** 把一条 v1 item 映射成本站形状；缺关键字段时返回 null（宁缺勿错）。 */
function mapItem(it) {
  const originalUrl = it?.links?.original;
  const aihotUrl = it?.links?.aihot ?? it?.attribution?.url;
  const title = it?.title;
  // 跳转目标是这个栏目的意义所在；没有原文链接的条目直接丢弃，不要渲染成死链。
  if (!title || !originalUrl) return null;

  const category = it.category ?? null;
  return {
    id: String(it.id),
    title: String(title),
    originalTitle: it.originalTitle ?? null,
    summary: it.summary ?? '',
    source: it?.source?.name ?? '未知来源',
    originalUrl: String(originalUrl),
    aihotUrl: aihotUrl ? String(aihotUrl) : null,
    publishedAt: it.publishedAt ?? it.discoveredAt ?? null,
    category,
    categoryLabel: CATEGORY_LABELS[category] ?? 'AI 动态',
    reason: it.reason ?? null,
  };
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const existing = readJson(NEWS_PATH, null);
  const existingCount = Array.isArray(existing) ? existing.length : 0;
  const meta = readJson(META_PATH, {});
  const etag = FORCE ? null : meta.etag ?? null;

  console.log(`AIHOT 抓取：${API}`);
  console.log(`  mode=selected window=7d  上限 ${MAX_ITEMS} 条${etag ? '  （带 ETag）' : ''}`);

  let first;
  try {
    first = await getJson(`${API}?mode=selected&window=7d&limit=100`, { etag });
  } catch (err) {
    return degrade(err.message, existingCount);
  }

  // 304：这一页没变，说明窗口内没有新增/变动，直接沿用已有数据。
  if (first.status === 304) {
    console.log(`  304 Not Modified —— 内容未变，保留现有 ${existingCount} 条`);
    return 0;
  }

  if (first.status !== 200) {
    return degrade(`接口返回 ${first.status} ${String(first.body).slice(0, 160)}`, existingCount);
  }

  // 首页 + 游标翻页。cursor 是不透明 token，原样回传，不解析。
  const raw = [...(first.body.items ?? [])];
  let cursor = first.body?.page?.nextCursor ?? null;
  let page = 1;
  const maxPages = Math.ceil(MAX_ITEMS / 100);

  while (cursor && raw.length < MAX_ITEMS && page < maxPages) {
    await sleep(250); // 官方要求按节奏取，不要并发猛拉
    let next;
    try {
      next = await getJson(`${API}?mode=selected&window=7d&limit=100&cursor=${encodeURIComponent(cursor)}`);
    } catch (err) {
      console.warn(`  第 ${page + 1} 页失败（${err.message}），用已取到的 ${raw.length} 条继续`);
      break;
    }
    if (next.status !== 200) {
      console.warn(`  第 ${page + 1} 页返回 ${next.status}，用已取到的 ${raw.length} 条继续`);
      break;
    }
    const batch = next.body.items ?? [];
    if (batch.length === 0) break;
    raw.push(...batch);
    cursor = next.body?.page?.nextCursor ?? null;
    page++;
  }

  const items = raw.map(mapItem).filter(Boolean);

  // 去重：同一个 id 在翻页边界可能重复出现。
  const seen = new Set();
  const deduped = items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));

  deduped.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));
  const capped = deduped.slice(0, MAX_ITEMS);

  if (capped.length === 0) {
    return degrade('映射后 0 条（接口结构可能变了）', existingCount);
  }

  // 丢弃的条目数要报出来：多数是「没有原文链接」的条目，属于预期，但骤增就是
  // 上游改了字段名，值得人看一眼。
  const dropped = raw.length - items.length;
  if (dropped > 0) console.log(`  跳过 ${dropped} 条（缺 title 或 links.original）`);

  // 原子写：先写临时文件再 rename，避免构建中途读到半截 JSON。
  mkdirSync(dirname(NEWS_PATH), { recursive: true });
  const tmp = `${NEWS_PATH}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(capped, null, 2)}\n`, 'utf8');
  renameSync(tmp, NEWS_PATH);

  writeFileSync(
    META_PATH,
    `${JSON.stringify(
      {
        source: 'AIHOT',
        api: 'https://aihot.news/api/v1',
        fetchedAt: new Date().toISOString(),
        etag: first.etag ?? null,
        count: capped.length,
        window: '7d',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const newest = capped[0]?.publishedAt ?? '—';
  const oldest = capped[capped.length - 1]?.publishedAt ?? '—';
  console.log(`  写入 ${capped.length} 条 → data/news.json`);
  console.log(`  时间范围 ${oldest} … ${newest}`);
  return 0;
}

/** 抓不到时的收尾：有历史数据就警告后放行，没有才报错。 */
function degrade(reason, existingCount) {
  if (existingCount > 0) {
    console.warn(`⚠ 抓取失败：${reason}`);
    console.warn(`  保留现有 ${existingCount} 条继续构建（新闻会停在上一版）`);
    return 0;
  }
  console.error(`✗ 抓取失败且没有历史数据：${reason}`);
  console.error('  data/news.json 不存在，构建会产出空的新闻页。先联网跑一次本脚本。');
  return 1;
}

const code = await main();
process.exit(code);
