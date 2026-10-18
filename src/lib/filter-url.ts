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
 *   - 键名固定 `q`（关键词）/ `cat`（分类，逗号分隔，保序）/ `tag`（标签）/
 *     `price`（`free` 表示只看免费）；
 *   - 空值一律不写进 URL，保证 `/tools` 而不是 `/tools?q=&cat=&tag=`；
 *   - 解析时忽略未知键、去重、去空，非法值不抛错（用户可能手改 URL）。
 */

export type FilterState = {
  q: string;
  cats: string[];
  tag: string;
  price: string;
};

export function emptyFilter(): FilterState {
  return { q: '', cats: [], tag: '', price: '' };
}

/** 从 `location.search`（或任意 `?a=b` 串）解析。 */
export function parseFilter(search: string): FilterState {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const q = (params.get('q') ?? '').trim();
  const cats = [
    ...new Set(
      (params.get('cat') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const tag = (params.get('tag') ?? '').trim();
  const price = (params.get('price') ?? '').trim();
  return { q, cats, tag, price: price === 'free' ? 'free' : '' };
}

/**
 * 序列化回查询串。返回 `''` 或 `'?q=…'`（始终带问号，方便直接拼）。
 * 键顺序固定为 q → cat → tag → price，保证同一个状态永远生成同一个 URL
 * （否则同一个筛选会有多种 URL，分享出去的两条链接看起来不一样）。
 */
export function buildFilter(state: FilterState): string {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (q) params.set('q', q);
  if (state.cats.length > 0) params.set('cat', state.cats.join(','));
  if (state.tag) params.set('tag', state.tag);
  if (state.price === 'free') params.set('price', 'free');
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** 是否有任何筛选生效（决定「重置筛选」按钮是否出现）。 */
export function hasFilter(state: FilterState): boolean {
  return Boolean(state.q.trim() || state.cats.length || state.tag || state.price);
}
