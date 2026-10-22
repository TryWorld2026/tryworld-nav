/**
 * `/tools` 的筛选状态 ⇄ URL 查询串。
 *
 * 为什么要有这个模块：原实现只在**挂载时读一次** URL（`useUrlFilter`），
 * 用户之后的任何操作都不写回去。实测后果（work/analysis-ia.md §9①）：
 *
 *   输入「视频」+ 点「AI视频/动画」→ 297 条，URL 仍是 `/tools`；
 *   点进详情再按浏览器返回 → 计数 2081、输入框清空、chip 清空、
 *   滚动位置 1200 → 160。
 *
 * 「筛一遍 → 看一个 → 回来接着挑」是导航站最高频的动作，每次都要从头再来一次；
 * 链接也没法分享给朋友。这里把状态与 URL 做成可逆的一对纯函数，组件只负责
 * 在合适的时机调用。
 *
 * 约定：
 *   - 键名固定 `q`（关键词）/ `cat`（分类）/ `tag`（标签）/ `price`（价格档）/
 *     `platform`（平台）/ `sort`（排序）/ `page`（页码）；**写出顺序就是这一条**；
 *   - 多值一律逗号分隔、去重保序；键名用单数、值可以是多个（沿用历史 URL）；
 *   - 默认值不写进 URL：空串、`sort=default`、`page=1` 都省略，保证 `/tools`
 *     而不是 `/tools?q=&cat=&page=1`；
 *   - 解析时忽略未知键与未知枚举值、去重、去空，非法值不抛错（用户可能手改
 *     URL），非法页码回退 1，超总页数由 `clampPage()` 钳到最后一页。
 */

/** 目录页的全部可分享状态。`sort` 的空串即「默认」（无查询=目录序，有查询=相关度）。 */
export type FilterState = {
  q: string;
  cats: string[];
  tags: string[];
  price: string;
  platforms: string[];
  sort: '' | 'updated' | 'name';
  page: number;
};

/** 可写进 `?price=` 的取值（`free` 是 `fully-free` 的历史别名，仍返回 238 条）。 */
const PRICE_VALUES = ['free', 'fully-free', 'open-source', 'freemium', 'paid', 'unrated'];

export function emptyFilter(): FilterState {
  return { q: '', cats: [], tags: [], price: '', platforms: [], sort: '', page: 1 };
}

/** 逗号分隔多值 → 去重保序数组；空项丢弃。 */
function list(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}

/** 页码：非正整数一律回退 1（`page=abc` / `page=0` / `page=-3` 都是手改 URL 的产物）。 */
function positiveInt(raw: string | null): number {
  const n = Number.parseInt((raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** 把页码钳进 `[1, totalPages]`；`totalPages` 非正（零结果）时回到 1。 */
export function clampPage(page: number, totalPages: number): number {
  if (!(totalPages > 0)) return 1;
  if (!(page > 0)) return 1;
  return Math.min(Math.floor(page), totalPages);
}

/** 从 `location.search`（或任意 `?a=b` 串）解析。 */
export function parseFilter(search: string): FilterState {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const rawPrice = (params.get('price') ?? '').trim().toLowerCase();
  const rawSort = (params.get('sort') ?? '').trim().toLowerCase();
  return {
    q: (params.get('q') ?? '').trim(),
    cats: list(params.get('cat')),
    tags: list(params.get('tag')),
    price: PRICE_VALUES.includes(rawPrice) ? rawPrice : '',
    platforms: list(params.get('platform')),
    // `sort=default` 与非法值都降级成「默认」，而不是把无效值带进状态。
    sort: rawSort === 'updated' || rawSort === 'name' ? rawSort : '',
    page: positiveInt(params.get('page')),
  };
}

/**
 * 序列化回查询串。返回 `''` 或 `'?q=…'`（始终带问号，方便直接拼）。
 * 键顺序固定为 q → cat → tag → price → platform → sort → page，保证同一个状态
 * 永远生成同一个 URL（否则同一个筛选会有多种 URL，分享出去的两条链接看起来不一样）。
 */
export function buildFilter(state: FilterState): string {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (q) params.set('q', q);
  if (state.cats.length > 0) params.set('cat', state.cats.join(','));
  if (state.tags.length > 0) params.set('tag', state.tags.join(','));
  if (PRICE_VALUES.includes(state.price)) params.set('price', state.price);
  if (state.platforms.length > 0) params.set('platform', state.platforms.join(','));
  if (state.sort) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** 是否有任何筛选生效（决定「重置筛选」按钮是否出现）。页码不算筛选。 */
export function hasFilter(state: FilterState): boolean {
  return Boolean(
    state.q.trim() ||
      state.cats.length ||
      state.tags.length ||
      state.price ||
      state.platforms.length ||
      state.sort,
  );
}
