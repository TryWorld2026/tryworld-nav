/**
 * 卡片数据 —— 客户端安全。
 *
 * 同一张 `ToolMiniCard` 在站内有**两种数据来源**，以前是靠「让服务端把完整
 * `Tool` 序列化进 HTML」来统一的，代价是 `/tools` 的 HTML 有 1.16 MB（每张卡
 * 都背着 `image` 的 55 字符截图路径、`variant`、`link`、`rawName` 这些卡片根本
 * 不读的字段）。
 *
 * 现在两边收敛到 `CardTool` 这个子集：
 *
 *   - 服务端页面（首页 / 分类 / 集合 / 详情页右栏）手里是完整 `Tool`，
 *     它**结构上就满足** `CardTool`，多出来的字段在这里不被读到，
 *     所以 5 处既有调用一行都不用改；
 *   - `/tools` 与命令面板手里只有 `data/search-index.json` 解出来的
 *     `SearchRecord`（客户端**不能**碰 `@/lib/data`，那会把 14 MB 正文拉进
 *     bundle），由 `cardFromRecord()` 显式转换。
 *
 * 这个模块只 import `data/nav.json`（5 KB，页眉本来就在用）与 `search.ts` 的
 * **类型**，所以 `'use client'` 组件引用它是安全的。价格与更新时间的**取值**
 * 在服务端那一侧（`card-server.ts`），因为那需要 14 MB 的 `tool-extras.json`。
 */
import { asset } from './assets';
import { navCategories } from './nav';
import type { PriceCode, SearchRecord } from './search';

// 排序与新鲜度文案住在 `card-sort.ts`（零 import，可被 node 测试直接 import）。
// 这里 re-export，让调用方继续只认 `@/lib/card` 一个入口。
export { freshLabel, sortCards, FRESH_DAYS, type SortableCard } from './card-sort';

/**
 * 卡片真正读到的那几个字段。
 *
 * `categories` 只取 `slug / name / color` 三项 —— `Tool.categories` 的元素是
 * 完整的 `Category`（还有 `id` / `icon` / `tailwind` / `hot` / `order`），
 * 结构上兼容，所以服务端可以直接把 `Tool` 传进来。
 */
export type CardTool = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  categories: { slug: string; name: string; color: string }[];
  /**
   * 价格档位。服务端从 `tool-extras.json` 的 `pricing` 映射（见 `card-server.ts`），
   * 客户端从索引的 `p` 字段。缺失 / 未采集是 `unrated`，卡片不挂胶囊。
   */
  price?: PriceCode;
  /** 更新时间，Unix **日序**。缺失时卡片不显示新鲜度标记。 */
  updated?: number;
  /**
   * 平台名（`Web` / `iOS` / `微信小程序`…）。
   *
   * 卡片只用前两个：一个只有 iOS 的工具对 Windows 用户是零，而这条信息现在
   * 藏在详情页里。服务端从 `tool-extras.json` 的 `platforms[].name` 取，
   * 客户端从索引的 `pl` 取（wire 里是 bitmask，已水化成名字数组）。
   * 没采到就是空数组 —— 卡片整行不渲染，不写「未知」。
   */
  platforms?: string[];
};

const navCategoryBySlug = new Map(navCategories.map((c) => [c.slug, c]));

/** `SearchRecord` → 卡片数据。分类名称与色值从 `nav.json` 补齐（索引里只存 slug）。 */
export function cardFromRecord(r: SearchRecord): CardTool {
  return {
    slug: r.s,
    name: r.n,
    description: r.d,
    // 索引里的 `i` 是站内相对路径（`/assets/icons/x.png`），索引本身**不能**
    // 预拼媒体主机 —— 那份 JSON 是构建期生成的静态文件，而 `NEXT_PUBLIC_`
    // 是构建期注入的环境变量，两者拼在一起会让同一份数据在不同构建下不一致。
    // 所以前缀一律在渲染边界上补：这里（客户端卡片）与 `card-server.ts`
    // （服务端卡片）。这是全站图标唯一的入口，加在这里就不会漏。
    icon: asset(r.i),
    tags: r.t,
    categories: r.c
      .map((slug) => navCategoryBySlug.get(slug))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ slug: c.slug, name: c.name, color: c.color })),
    price: r.p,
    updated: r.u,
    platforms: r.pl,
  };
}
