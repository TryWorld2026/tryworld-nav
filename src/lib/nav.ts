/**
 * 客户端安全的导航数据（26 分类 / 5 常用推荐 / 9 标签）。
 *
 * 由 `scripts/generate-nav.mjs` 从 data/*.json 生成，`npm run build` 会先跑它。
 * 体积 5 KB / br 1.4 KB —— 对比 `lib/data.ts` 拉进来的约 1.4 MB 内容 JSON，
 * 这是「每个页面都要付」的那笔钱里最该省的一笔。
 *
 * 只给 `'use client'` 组件（页眉、移动抽屉、侧栏、搜索面板）用。服务端组件
 * 继续走 `lib/data.ts`（它需要完整目录、排序、prose 访问器）。
 */
import rawNav from '../../data/nav.json';
import { asset } from './assets';

type RawNav = {
  categories: {
    slug: string;
    name: string;
    icon: string;
    color: string;
    tailwind: string;
    hot: boolean;
  }[];
  featured: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    href: string;
  }[];
  tags: { slug: string; name: string; iconUrl: string }[];
};

const nav = rawNav as RawNav;

/** 26 个分类，保持 categories.json 的顺序（`order` 已在生成时排好）。 */
export const navCategories = nav.categories.map((c) => ({ ...c }));
/** 18 个标记 hot 的分类（侧栏「常用分类」用它，与站内口径一致）。 */
export const navHotCategories = navCategories.filter((c) => c.hot);
/** 5 个「常用推荐」，`href` 已在构建期解析成站内路径或外链。 */
export const navFeatured = nav.featured.map((t) => ({ ...t, icon: asset(t.icon) }));
/** 9 个标签（图标同源映射）。 */
export const navTags = nav.tags.map((t) => ({ ...t, iconUrl: asset(t.iconUrl) }));
