/**
 * AIHOT 事件详情（story）的纯映射函数。
 *
 * 抓取脚本和 `tests/aihot-story.test.mjs` 共用这一层，避免把「归一化来源对象」
 * 「清洗模板 URL」这类容易出错的规则埋在 main() 里。这里不读文件、不发请求。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** 只接受 http/https 绝对 URL；模板占位符（如 `{{SERIAL_x}}`）一律拒绝。 */
export function safeHttpUrl(value) {
  const s = text(value);
  if (!s || s.includes('{{') || s.includes('}}')) return null;
  try {
    const url = new URL(s);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname ? s : null;
  } catch {
    return null;
  }
}

/**
 * 从 URL 的 pathname 中提取事件 UUID；也接受裸 UUID。
 *
 * `links.story` 可能来自不同环境（绝对 URL 或站内路径），所以只要求
 * HTTP/HTTPS 绝对 URL 或裸 UUID，不绑定 AIHOT 域名。模板占位符一律拒绝。
 */
export function storyIdFromUrl(value) {
  const s = text(value);
  if (!s || s.includes('{{') || s.includes('}}')) return null;
  if (UUID_RE.test(s)) return s.toLowerCase();
  const absolute = safeHttpUrl(s);
  if (!absolute) return null;
  const segments = new URL(absolute).pathname.split('/');
  const hit = segments.find((segment) => UUID_RE.test(segment));
  return hit ? hit.toLowerCase() : null;
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** 通用链接裁剪：保留渲染需要的三个键，至少有一个才返回对象。 */
export function slimLinks(links) {
  if (!links || typeof links !== 'object') return null;
  const out = {};
  for (const key of ['original', 'aihot', 'story']) {
    const value = text(links[key]);
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * 报道链接：原文不可用时回退到 AIHOT 条目；两者都不可用返回 `{}`。
 * 注意这里**不保留** report 上的 `story`，来源追溯只给原文与 AIHOT 条目。
 */
export function cleanReportLinks(links) {
  const aihot = safeHttpUrl(links?.aihot);
  const original = safeHttpUrl(links?.original) ?? aihot;
  const out = {};
  if (original) out.original = original;
  if (aihot) out.aihot = aihot;
  return out;
}

/** `{ name, firstParty }` / 字符串 / 缺失 → `{ name, firstParty }`。 */
export function normalizeSource(source, fallbackFirstParty = false) {
  if (source && typeof source === 'object') {
    return {
      name: text(source.name) || '未知来源',
      firstParty: source.firstParty === true || fallbackFirstParty === true,
    };
  }
  return {
    name: text(source) || '未知来源',
    firstParty: fallbackFirstParty === true,
  };
}

function safeIso(value) {
  const s = text(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : s;
}

function positiveInt(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** 单条报道 → 落盘形状。标题与 id 都缺失时丢弃。 */
export function mapReport(report, index = 0) {
  if (!report || typeof report !== 'object') return null;
  const title = text(report.title);
  const id = text(report.id);
  if (!title && !id) return null;
  const source = normalizeSource(report.source, report.firstParty === true);
  return {
    id: id || `report-${index + 1}`,
    title: title || '未命名报道',
    summary: text(report.summary),
    source: source.name,
    firstParty: source.firstParty,
    publishedAt: safeIso(report.publishedAt),
    links: cleanReportLinks(report.links),
  };
}

/** 响应可能是 `{ schemaVersion, story }`，也可能直接是 story。 */
export function unwrapStory(payload) {
  if (payload && typeof payload === 'object' && payload.story && typeof payload.story === 'object') {
    return payload.story;
  }
  return payload && typeof payload === 'object' ? payload : null;
}

/**
 * 事件详情响应 → `data/aihot-stories.json` 的单个条目。
 *
 * `storyline` / `related` 在公开响应里目前都是空数组，P0 不猜其结构，因此
 * 不落盘、不渲染。缺失的计数从 reports 派生，缺时间的报道稳定排在末尾。
 */
export function mapStory(payload) {
  const raw = unwrapStory(payload);
  if (!raw) return null;
  const publicId = text(raw.publicId).toLowerCase();
  const title = text(raw.title);
  if (!isUuid(publicId) || !title) return null;

  const reports = (Array.isArray(raw.reports) ? raw.reports : [])
    .map((report, index) => mapReport(report, index))
    .filter(Boolean)
    .map((report, index) => ({ report, index }))
    .sort((a, b) => {
      const at = a.report.publishedAt ? new Date(a.report.publishedAt).getTime() : NaN;
      const bt = b.report.publishedAt ? new Date(b.report.publishedAt).getTime() : NaN;
      const av = Number.isNaN(at);
      const bv = Number.isNaN(bt);
      if (av && bv) return a.index - b.index;
      if (av) return 1;
      if (bv) return -1;
      return bt - at || a.index - b.index;
    })
    .map(({ report }) => report);

  const dated = reports.filter((report) => report.publishedAt);
  const derivedFirst = dated.length > 0 ? dated[dated.length - 1].publishedAt : null;
  const derivedLatest = dated.length > 0 ? dated[0].publishedAt : null;
  const sourceNames = new Set(reports.map((report) => report.source).filter(Boolean));
  const link =
    safeHttpUrl(raw.links?.aihot) ??
    safeHttpUrl(raw.links?.original) ??
    null;

  return {
    publicId,
    title,
    status: text(raw.status),
    sourceCount: positiveInt(raw.sourceCount, sourceNames.size),
    reportCount: positiveInt(raw.reportCount, reports.length),
    firstReportAt: safeIso(raw.firstReportAt) ?? derivedFirst,
    latestAt: safeIso(raw.latestAt) ?? derivedLatest,
    latest: text(raw.latest) || null,
    digest: text(raw.digest) || null,
    digestUpdatedAt: safeIso(raw.digestUpdatedAt),
    link,
    reports,
  };
}
