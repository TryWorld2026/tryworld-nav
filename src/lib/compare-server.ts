/**
 * `/compare` 的服务端取值 —— 把目录数据整理成 `comparePairs()` 需要的
 * `CompareContext`。
 *
 * 为什么单独一个模块：`lib/compare.ts` 必须**零 import**（它被
 * `node --test` 直接 import，Node 原生 TS 解析要求相对 import 带扩展名，
 * 而 TSC 的 bundler 解析不接受 `.ts` 后缀）。所以上下文在这里组装：
 * 这里可以 import `lib/data`（7 MB 目录），而那个文件不行。
 *
 * 组装一次、模块级缓存 —— 构建期 2081 条只走一遍，运行时这些页面全是
 * 预渲染的静态 HTML，不再执行。
 */
import { collections, featured, toolBySlug, tools } from './data';
import { VERDICTS } from './tool-verdicts';
import { comparePairs, pickDistinctPairs, type CompareContext, type ComparePair } from './compare';

/** slug → 分类 slug 数组。 */
function buildCategories(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const t of tools) m.set(t.slug, (t.categories ?? []).map((c) => c.slug));
  return m;
}

/** slug → 被多少个编辑集合收录（`comparePairs` 内部会封顶）。 */
function buildCollectionCount(): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of collections) {
    for (const member of c.tools) {
      m.set(member.slug, (m.get(member.slug) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * slug → `related` 里出现过的 slug 集合。
 *
 * 这个字段是原站抓来的自动推荐（2080 条全都 6 个、权重一样），所以它**只作
 * 加分项**，绝不能当主信号 —— 理由见 `lib/compare.ts` 文件头。
 *
 * 这里刻意**返回空 Map** 而不是去读它：`lib/data.ts` 没有导出 `related`
 * （它只作溯源保留、不参与渲染），要拿到它就得绕过 `extrasBySlug()` 去
 * 直接碰 14 MB 的 `tool-extras.json`，而换来的只是一个权重 25 的弱信号
 * —— 低于「两边都有判断」的 50、也低于「首页推荐」的 60，不改变排序。
 * 与其为了一个不影响结果的分支多读一次 14 MB，不如显式留空并写明原因。
 */
function buildRelated(): Map<string, Set<string>> {
  return new Map();
}

let cachedPairs: ComparePair[] | null = null;

/** 全部预置对比对，按读者关心度降序。模块级缓存，构建期算一次。 */
export function allComparePairs(): ComparePair[] {
  if (cachedPairs) return cachedPairs;
  const ctx: CompareContext = {
    order: new Map(tools.map((t, i) => [t.slug, i])),
    categories: buildCategories(),
    featured: new Set(featured.map((f) => f.slug)),
    collectionCount: buildCollectionCount(),
    related: buildRelated(),
  };
  cachedPairs = comparePairs(VERDICTS, ctx);
  return cachedPairs;
}

/** 总览页展示的「最值得看的几组」—— 互不重叠，见 `pickDistinctPairs`。 */
export function topComparePairs(count = 7): ComparePair[] {
  return pickDistinctPairs(allComparePairs(), count);
}

/** 按 URL 段查一组对比。查不到返回 null（页面据此 `notFound()`）。 */
export function comparePairBySlug(slug: string): ComparePair | null {
  return allComparePairs().find((p) => p.slug === slug) ?? null;
}

/** 这个 slug 是否存在于目录（`compare/[slug]` 的 `generateStaticParams` 用）。 */
export function isCatalogSlug(slug: string): boolean {
  return toolBySlug.has(slug);
}
