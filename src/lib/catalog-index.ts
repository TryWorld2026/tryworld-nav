/**
 * 客户端目录索引 —— 唯一被下发给浏览器的工具数据集。
 *
 * 为什么单独开一个模块而不是继续用 `@/lib/data`：`data.ts` 会 import
 * `data/tool-extras.json`（14 MB 正文与内联 SVG）。客户端组件哪怕只用其中一个
 * 函数，也会把整份模块拉进 bundle。这里只 import 搜索索引本身，解码一次后
 * 全站共享同一份数组，`tools-explorer` 与 `command-dialog` 都从这里取数。
 *
 * 这份数据同时是目录的**浏览**数据源（slug / 名称 / 简介 / 图标 / 分类 / 标签 /
 * 关键词 / 价格 / 平台 / 更新时间 / 有无官网），所以 `/tools` 的服务端渲染不再
 * 需要序列化 2081 个完整 Tool —— 那正是目录首屏超 400 KB 的根因。
 */
import rawSearchIndex from '../../data/search-index.json';
import { decodeSearchIndex, type SearchRecord } from './search';

/** 解码后的全量索引，顺序 = `tools.json` 的目录顺序（字段 `o` 即该序号）。 */
export const CATALOG_INDEX: SearchRecord[] = decodeSearchIndex(rawSearchIndex);

/** slug → 记录。卡片与命令面板用它做 O(1) 取数，避免每次搜索都建 Map。 */
export const CATALOG_BY_SLUG: Map<string, SearchRecord> = new Map(
  CATALOG_INDEX.map((r) => [r.s, r]),
);

/**
 * 数据快照的最新一天 —— 全站「新鲜度」的唯一参照点（Unix 日序）。
 *
 * **为什么不能读 `Date.now()`**：这个站是纯静态导出，`contentBuildId()` 拿
 * `src/` 与指定数据的哈希当 buildId，目的就是「没改内容就一个字节都不变」
 * （部署从 51 分钟压到 24 秒）。渲染期一旦读墙钟，「3 天前更新」这类相对
 * 文案会每天变一次，等于每天都全量重传一次站点。
 *
 * 取「目录里最新的那条 `updated`」，相对数据自己说话，构建产物就是确定的；
 * 同时它把「新鲜度」这句话校准到真实含义上 —— 审计里最扎心的一条正是页面
 * 曾把「更新于 2025年10月11日」当新鲜度徽章展示，而 88.75% 的条目其实都已
 * 超过一年。
 */
export const DATA_EPOCH: number | undefined = CATALOG_INDEX.reduce<number | undefined>(
  (max, r) => (typeof r.u === 'number' && (max === undefined || r.u > max) ? r.u : max),
  undefined,
);
