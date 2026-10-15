/**
 * 新闻卡片的时间展示。
 *
 * AIHOT 的 `publishedAt` 是 ISO-8601 UTC，而读者在中国。直接切字符串
 * （`publishedAt.slice(0, 10)`）会得到 UTC 日期：一条 `2026-10-15T11:00:00Z`
 * 的条目在北京是 10-15 19:00，看着没错；但 `2026-10-14T18:00:00Z` 在北京已经是
 * 10-15 02:00，切出来就少了一天。所以一律走 `Intl` 按 `Asia/Shanghai` 格式化。
 *
 * 这里**不使用** `new Date().getTime()` 之外的运行时状态——`relativeLabel` 的
 * 「今天/昨天」是相对**构建时刻**算的。静态站没有请求时间，页面在构建时就定格了，
 * 所以这个「今天」指的是构建那天。卡片上因此始终同时给出绝对日期，避免隔夜后
 * 出现「今天」实际是前天这种误导。
 */

const TZ = 'Asia/Shanghai';

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** `2026年10月15日`；无法解析时回退成空串而不是 `Invalid Date`。 */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? dateFmt.format(d) : '';
}

/** `2026年10月15日 19:00` —— 详情与 `<time>` 的 title 用。 */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? dateTimeFmt.format(d) : '';
}

/**
 * `2026/10/15`，卡片的紧凑日期。
 *
 * 手写而不是再建一个 `Intl`：`zh-CN` 的 numeric 格式会给出 `2026/10/15`，
 * 但不同 Node/ICU 版本对分隔符与补零的处理有差异，而这里要的是稳定输出。
 * 取值本身仍走 `Intl`（见 `shanghaiParts`），所以时区换算是对的。
 */
export function formatDateShort(iso: string | null | undefined): string {
  const p = shanghaiParts(iso);
  return p ? `${p.year}/${p.month}/${p.day}` : '';
}

/**
 * 相对构建时刻的粗粒度标签：`今天` / `昨天` / `3 天前`。
 * 超过 7 天返回空串——资讯卡片不需要「上个月」这种冗余，绝对日期已经给了。
 */
export function relativeLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  const a = shanghaiParts(d);
  const b = shanghaiParts(now);
  if (!a || !b) return '';

  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  const diff = Math.round((dayB - dayA) / 86_400_000);

  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff <= 7) return `${diff} 天前`;
  return '';
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 取一个时刻在北京时间下的年月日，用 `en-CA` 的 ISO 形输出避免再解析文本。 */
function shanghaiParts(input: string | Date | null | undefined) {
  const d = typeof input === 'string' || input === null || input === undefined ? parse(input) : input;
  if (!d || Number.isNaN(d.getTime())) return null;
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}
