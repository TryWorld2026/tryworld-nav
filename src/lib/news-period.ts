/**
 * 日报 / 周报 / 月报 / 热点榜的纯函数层。
 *
 * 和 `lib/news.ts` 一样，这里只处理数据、不碰 React、不碰 window，所以可以在
 * `tests/news-period.test.mjs` 里用 `node --test` 直接 import 这个 .ts 跑。
 * 组件只负责渲染。
 *
 * 时间口径：JSON 里的 `date` / `periodStart` / `periodEnd` 都是 `YYYY-MM-DD`
 * （AIHOT 按北京日历日切分），而 `generatedAt` / `publishedAt` / `latestAt`
 * 是 ISO-8601 UTC。**日期键一律手工拆成 Y/M/D**，不用 `new Date('2026-10-17')`
 * ——后者按 UTC 午夜解析，虽然在北京时间下仍是同一天，但一旦有人改了展示时区
 * 就会静默差一天。这里明确按「字符串就是北京日历日」处理。
 *
 * 文案口径：页面上出现的「第 N 期」「N 件大事」「约 N 分钟」全部由数据算出，
 * 不写死。AIHOT 的 HTML 里还有「N 件一手发布」，但公开 API 不提供一手/转述
 * 的标记，所以本站**不伪造**这一项，改用「N 个栏目」。
 */

/* ------------------------------------------------------------------ *
 * 类型：与 scripts/fetch-aihot-daily.mjs 写出的形状一一对应。           *
 * ------------------------------------------------------------------ */

export type PeriodLinks = { original?: string; aihot?: string };

export type DailyLead = { title: string; leadParagraph: string };

export type DailyItem = {
  title: string;
  summary: string;
  source: string;
  links: PeriodLinks;
};

export type DailyFlash = {
  title: string;
  source: string;
  publishedAt: string | null;
  links: PeriodLinks;
};

export type DailySection = {
  label: string;
  items: DailyItem[];
};

export type DailyReport = {
  date: string;
  generatedAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  link: string | null;
  lead: DailyLead | null;
  sections: DailySection[];
  flashes: DailyFlash[];
};

export type DailyArchiveEntry = {
  date: string;
  generatedAt: string | null;
  leadTitle: string | null;
  leadParagraph: string | null;
  link: string | null;
};

export type PeriodItem = DailyItem & { publishedAt: string | null };

export type PeriodSection = {
  label: string;
  summary: string | null;
  items: PeriodItem[];
};

export type WeeklyReport = {
  week: string;
  periodStart: string | null;
  periodEnd: string | null;
  generatedAt: string | null;
  link: string | null;
  headline: string | null;
  overview: string | null;
  sections: PeriodSection[];
};

export type MonthlyReport = Omit<WeeklyReport, 'week'> & { month: string };

export type HotTopic = {
  rank: number;
  id: string;
  title: string;
  source: string;
  sourceCount: number;
  signalCount: number;
  participantCount: number;
  sourceNames: string[];
  latestAt: string | null;
  links: PeriodLinks;
};

export type AihotDailyData = {
  source: string;
  fetchedAt: string;
  archive: DailyArchiveEntry[];
  days: Record<string, DailyReport>;
  weeks: Record<string, WeeklyReport>;
  months: Record<string, MonthlyReport>;
  hot: HotTopic[];
  counts: { days: number; weeks: number; months: number; hot: number };
};

/* ------------------------------------------------------------------ *
 * 日期工具（全部按「字符串即北京日历日」处理，不经过时区换算）。          *
 * ------------------------------------------------------------------ */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** `2026-10-17` → `{ y: 2026, m: 10, d: 17 }`；非法输入返回 null。 */
export function parseDateKey(key: string | null | undefined) {
  if (!key) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // 用 Date.UTC 回验：2026-02-31 会被解析成 3 月 3 日，与传入的日不同则拒绝。
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCDate() !== d || probe.getUTCMonth() !== mo - 1) return null;
  return { y, m: mo, d };
}

/** 日期键的星期序号（0=周日），用 UTC 算，与本地时区无关。 */
export function weekdayIndex(key: string): number {
  const p = parseDateKey(key);
  if (!p) return 0;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** `周六`；非法日期返回空串。 */
export function weekdayZh(key: string): string {
  return parseDateKey(key) ? WEEKDAYS[weekdayIndex(key)] : '';
}

/** `2026 年 10 月 17 日`。 */
export function formatDateFull(key: string): string {
  const p = parseDateKey(key);
  return p ? `${p.y} 年 ${p.m} 月 ${p.d} 日` : '';
}

/** `10 月 17 日`。 */
export function formatDateShort(key: string): string {
  const p = parseDateKey(key);
  return p ? `${p.m} 月 ${p.d} 日` : '';
}

/** `2026-10` → `2026 年 10 月`。 */
export function formatMonth(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? '');
  return m ? `${m[1]} 年 ${Number(m[2])} 月` : '';
}

/** 两个日期键相差的天数（`b - a`）。 */
export function dayGap(a: string, b: string): number {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  if (!pa || !pb) return NaN;
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000,
  );
}

/** 日期键加减天数。 */
export function shiftDate(key: string, days: number): string {
  const p = parseDateKey(key);
  if (!p) return '';
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** ISO-8601 UTC → 北京时间 `HH:mm`；非法值返回空串。 */
export function beijingTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/* ------------------------------------------------------------------ *
 * 日报。                                                              *
 * ------------------------------------------------------------------ */

/** 一期日报的全部条目（正文 + 快讯），顺序即阅读顺序。 */
export function allDailyItems(report: DailyReport): (DailyItem | DailyFlash)[] {
  const items: (DailyItem | DailyFlash)[] = [];
  for (const s of report.sections) items.push(...s.items);
  items.push(...report.flashes);
  return items;
}

/**
 * 统计条：`12 件大事 · 11 个来源 · 5 个栏目 · 约 5 分钟`。
 *
 * 阅读时长按中文 400 字/分钟估算，只算标题与摘要（正文不在 API 里），并向下
 * 取整、最少 1 分钟。这是**估算**，页面上写作「约 N 分钟」，不装作精确。
 */
export function dailyStats(report: DailyReport): {
  items: number;
  sources: number;
  sections: number;
  flashes: number;
  minutes: number;
} {
  const all = allDailyItems(report);
  const sources = new Set<string>();
  let chars = 0;
  for (const it of all) {
    if (it.source) sources.add(it.source);
    chars += it.title.length + ('summary' in it ? it.summary.length : 0);
  }
  return {
    items: all.length,
    sources: sources.size,
    sections: report.sections.length,
    flashes: report.flashes.length,
    minutes: Math.max(1, Math.round(chars / 400)),
  };
}

/**
 * 本期版面：`01 模型发布/更新 1 件`，带锚点。
 *
 * 锚点用序号而不是标签：标签里有 `/` 与中文，做 id 需要编码，而序号在本期
 * 内天然唯一、也更好读。`scroll-mt` 由渲染层负责。
 */
export function numberedSections(report: DailyReport): {
  index: string;
  anchor: string;
  label: string;
  count: number;
  items: DailyItem[];
}[] {
  return report.sections.map((s, i) => ({
    index: String(i + 1).padStart(2, '0'),
    anchor: `s-${i + 1}`,
    label: s.label,
    count: s.items.length,
    items: s.items,
  }));
}

/**
 * 今日看点：取每个栏目的第一条，最多 `n` 条。
 *
 * AIHOT 的「今日看点」是编辑挑的；公开 API 没有这个字段，所以这里**明确按
 * 「各栏目头条」派生** —— 页面上写「各栏目头条」，不冒称编辑精选。
 */
export function highlights(
  report: DailyReport,
  n = 3,
): { title: string; source: string; anchor: string; sectionLabel: string }[] {
  const out: { title: string; source: string; anchor: string; sectionLabel: string }[] = [];
  const secs = numberedSections(report);
  for (const s of secs) {
    const first = s.items[0];
    if (!first) continue;
    out.push({
      title: first.title,
      source: first.source,
      anchor: s.anchor,
      sectionLabel: s.label,
    });
    if (out.length >= n) break;
  }
  return out;
}

/**
 * 头条的跳转链接。
 *
 * API 的 `lead` 只有标题与导语，**没有** links；而同一篇文章必然也出现在某个
 * 栏目的条目里。所以按标题精确匹配回条目，拿到 `links.original`。匹配不到
 * （例如头条是编辑部额外写的综述）时返回 null，渲染层就不给「原文」按钮，
 * 而不是猜一个链接。
 */
export function leadLinks(report: DailyReport): PeriodLinks | null {
  const lead = report.lead;
  if (!lead) return null;
  for (const s of report.sections) {
    const hit = s.items.find((it) => it.title === lead.title);
    if (hit) return hit.links;
  }
  return null;
}

/** 头条条目的来源站名；匹配不到返回 null。 */
export function leadSource(report: DailyReport): string | null {
  const lead = report.lead;
  if (!lead) return null;
  for (const s of report.sections) {
    const hit = s.items.find((it) => it.title === lead.title);
    if (hit) return hit.source;
  }
  return null;
}

/**
 * 期号。AIHOT 的期号就是该期在归档里的顺序（第 179 期 = 归档第 179 天）。
 * `archive` 是倒序的（最新在前），所以用「总数 - 倒序下标」还原。
 */
export function issueNumber(archive: DailyArchiveEntry[], date: string): number {
  const idx = archive.findIndex((e) => e.date === date);
  if (idx < 0) return 0;
  return archive.length - idx;
}

/** 归档里某期的前一天 / 后一天（按归档，不是按自然日）。 */
export function dailyNeighbors(
  archive: DailyArchiveEntry[],
  date: string,
): { prev: DailyArchiveEntry | null; next: DailyArchiveEntry | null } {
  const i = archive.findIndex((e) => e.date === date);
  if (i < 0) return { prev: null, next: null };
  // 归档倒序：i+1 是更旧的一天，i-1 是更新的一天。
  return { prev: archive[i + 1] ?? null, next: archive[i - 1] ?? null };
}

/**
 * 日期分页控件：当前期 + 前两期 + 「更早」。
 *
 * 与 AIHOT 的 `今天 / 10月16日 / 10月15日 / 更早` 同一形态，但标签按
 * 「距最新一期几天」决定：0 → 今天，1 → 昨天，其余给绝对日期。
 */
export function dailyPager(
  archive: DailyArchiveEntry[],
  date: string,
  latestDate: string,
): { date: string | null; label: string; current: boolean }[] {
  const i = archive.findIndex((e) => e.date === date);
  if (i < 0) return [];
  // 归档是**最新在前**，所以当前期之后（更旧）的期在数组里是 i+1、i+2…
  const out: { date: string | null; label: string; current: boolean }[] = [];
  for (const offset of [0, 1, 2]) {
    const entry = archive[i + offset];
    if (!entry) continue;
    const gap = dayGap(entry.date, latestDate);
    const label = gap === 0 ? '今天' : gap === 1 ? '昨天' : formatDateShort(entry.date);
    out.push({ date: entry.date, label, current: offset === 0 });
  }
  // 「更早」= 当前期往后第 4 期，没有就指向归档页（`date: null` 由渲染层换成
  // 「全部往期」链接）。
  const older = archive[i + 3];
  if (older) out.push({ date: older.date, label: '更早', current: false });
  else if (i + 3 > archive.length - 1) out.push({ date: null, label: '更早', current: false });
  return out;
}

/* ------------------------------------------------------------------ *
 * 归档与日历。                                                         *
 * ------------------------------------------------------------------ */

/**
 * 把归档按月分组：`[{ key:'2026-10', label:'2026 年 10 月', days:[...] }]`。
 * 组内保持传入顺序（归档本身倒序），组间也倒序。
 */
export function archiveGroups(archive: DailyArchiveEntry[]): {
  key: string;
  label: string;
  days: DailyArchiveEntry[];
}[] {
  const map = new Map<string, DailyArchiveEntry[]>();
  for (const e of archive) {
    const key = e.date.slice(0, 7);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, days]) => ({ key, label: formatMonth(key), days }));
}

/**
 * 某个月的日历网格（周一开头，7 列）。
 *
 * `hasIssue` 决定数字是否可点：归档里没有的那天渲染成灰色不可点，而不是死链。
 * 前置空位用 `null` 占位，长度固定补到 7 的倍数。
 */
export function monthCalendar(
  date: string,
  archive: DailyArchiveEntry[],
): {
  key: string;
  label: string;
  cells: ({ date: string; day: number; hasIssue: boolean } | null)[];
  prevMonthAnchor: string | null;
  nextMonthAnchor: string | null;
} | null {
  const p = parseDateKey(date);
  if (!p) return null;
  const key = `${p.y}-${String(p.m).padStart(2, '0')}`;
  const first = new Date(Date.UTC(p.y, p.m - 1, 1));
  const daysInMonth = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
  // getUTCDay: 0=周日。转成「周一=0」的偏移。
  const lead = (first.getUTCDay() + 6) % 7;
  const withIssue = new Set(archive.filter((e) => e.date.startsWith(key)).map((e) => e.date));

  const cells: ({ date: string; day: number; hasIssue: boolean } | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${key}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dk, day: d, hasIssue: withIssue.has(dk) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = p.m === 1 ? `${p.y - 1}-12` : `${p.y}-${String(p.m - 1).padStart(2, '0')}`;
  const nextMonth = p.m === 12 ? `${p.y + 1}-01` : `${p.y}-${String(p.m + 1).padStart(2, '0')}`;
  const prevDays = archive.filter((e) => e.date.startsWith(prevMonth));
  const nextDays = archive.filter((e) => e.date.startsWith(nextMonth));

  return {
    key,
    label: formatMonth(key),
    cells,
    // 上一月取该月最后一期（归档倒序的第一条），下一月取该月第一期。
    prevMonthAnchor: prevDays[0]?.date ?? null,
    nextMonthAnchor: nextDays[nextDays.length - 1]?.date ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * 周报 / 月报。                                                        *
 * ------------------------------------------------------------------ */

/** 周报键 → `2026 年第 41 周`。 */
export function formatWeek(week: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(week ?? '');
  return m ? `${m[1]} 年第 ${Number(m[2])} 周` : '';
}

/** `2026-10-05` + `2026-10-11` → `10 月 5 日 – 10 月 11 日`。 */
export function formatPeriodRange(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

/** 期报的全部条目（跨栏目拍平）。 */
export function periodItems(report: WeeklyReport | MonthlyReport): PeriodItem[] {
  return report.sections.flatMap((s) => s.items);
}

/** 期报统计：条目数、来源数、栏目数、估算分钟。 */
export function periodStats(report: WeeklyReport | MonthlyReport): {
  items: number;
  sources: number;
  sections: number;
  minutes: number;
} {
  const items = periodItems(report);
  const sources = new Set(items.map((i) => i.source).filter(Boolean));
  let chars = 0;
  for (const it of items) chars += it.title.length + it.summary.length;
  return {
    items: items.length,
    sources: sources.size,
    sections: report.sections.length,
    minutes: Math.max(1, Math.round(chars / 400)),
  };
}

/** 期报锚点：`p-1`。 */
export function periodAnchor(i: number): string {
  return `p-${i + 1}`;
}

/* ------------------------------------------------------------------ *
 * 热点榜。                                                            *
 * ------------------------------------------------------------------ */

/**
 * 热度条的相对宽度（相对榜首，最小 12%）。
 *
 * 用 `signalCount`（跨来源信号数）而不是 `participantCount`：后者是「观察到的
 * 参与者」，口径更接近人数，但缺值时会是 0；`signalCount` 每条都有。全部为 0
 * 时回退到 `sourceCount`，再回退到等宽。
 */
export function hotBarWidth(topic: HotTopic, topics: HotTopic[]): number {
  const metric = (t: HotTopic) => t.signalCount || t.sourceCount || 1;
  const max = Math.max(...topics.map(metric), 1);
  return Math.max(12, Math.round((metric(topic) / max) * 100));
}
