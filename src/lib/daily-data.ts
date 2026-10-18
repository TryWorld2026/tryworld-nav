/**
 * AIHOT 日报 / 周报 / 月报 / 热点榜的数据入口。
 *
 * 与 `lib/data.ts` 分开的理由：`lib/data.ts` 被 `tools-explorer.tsx` 等客户端
 * 组件间接引入，而日报数据（1.4 MB）**只给服务端组件**用。放在一起会让整份
 * 日报 JSON 有被拖进客户端包的风险；单独一个模块，只有服务端 import 它，
 * 打包器能干净地树摇掉。
 *
 * 数据来自 `scripts/fetch-aihot-daily.mjs`（`npm run build` 的第一步之一）。
 * 文件缺失时导出空结构而不是抛错：静态导出会在构建时把每个页面渲染一遍，
 * 一个 throw 会让整个构建挂掉，而「暂时没有日报」是可降级的。
 */
import raw from '../../data/aihot-daily.json';
import type {
  AihotDailyData,
  DailyArchiveEntry,
  DailyReport,
  HotTopic,
  MonthlyReport,
  WeeklyReport,
} from './news-period';

const EMPTY: AihotDailyData = {
  source: 'AIHOT',
  fetchedAt: '',
  archive: [],
  days: {},
  weeks: {},
  months: {},
  hot: [],
  counts: { days: 0, weeks: 0, months: 0, hot: 0 },
};

const data = (raw && typeof raw === 'object' ? raw : EMPTY) as AihotDailyData;

/** 归档列表，最新在前。 */
export const dailyArchive: DailyArchiveEntry[] = Array.isArray(data.archive) ? data.archive : [];

/** 最新一期的日期键；没有数据时为空串。 */
export const latestDailyDate: string = dailyArchive[0]?.date ?? '';

/** 某一期日报；不存在返回 null。 */
export function getDaily(date: string): DailyReport | null {
  const d = data.days?.[date];
  return d && d.date === date ? d : null;
}

/** 全部日报，最新在前（与归档同序）。 */
export function listDailies(): DailyReport[] {
  return dailyArchive
    .map((e) => getDaily(e.date))
    .filter((d): d is DailyReport => d !== null);
}

/** 最新一期日报；没有数据返回 null。 */
export function latestDaily(): DailyReport | null {
  return latestDailyDate ? getDaily(latestDailyDate) : null;
}

/** 周报，最新在前。 */
export const weeklyReports: WeeklyReport[] = Object.values(data.weeks ?? {}).sort((a, b) =>
  a.week < b.week ? 1 : a.week > b.week ? -1 : 0,
);

/** 月报，最新在前。 */
export const monthlyReports: MonthlyReport[] = Object.values(data.months ?? {}).sort((a, b) =>
  a.month < b.month ? 1 : a.month > b.month ? -1 : 0,
);

/** 当前热点 Top 10。 */
export const hotTopics: HotTopic[] = Array.isArray(data.hot) ? data.hot : [];

/** 数据抓取时刻，用于页脚「数据更新于」。 */
export const dailyFetchedAt: string = data.fetchedAt ?? '';
