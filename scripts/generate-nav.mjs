/**
 * 生成客户端导航数据 `data/nav.json`。
 *
 * 背景：页眉、移动抽屉、侧栏、搜索面板都是客户端组件，但它们只需要
 * 「26 个分类的名字/图标/颜色」「5 个常用推荐」「9 个标签」—— 三样加起来
 * 8 KB。原先它们 `import { ... } from '@/lib/data'`，而那个模块会拖进
 * 2081 条工具与 14 MB prose（br 后约 182 KB，**每个页面都要付**）。
 *
 * 这里把客户端真正需要的三张表抽出来，并且**在构建期把 href 解析好**：
 * `data.ts` 里的 `featured` 有一条规则「若工具不在目录中则退回外链」，
 * 客户端没有 `toolBySlug`，所以必须在生成时算完。
 *
 *   node scripts/generate-nav.mjs          写入 data/nav.json
 *   node scripts/generate-nav.mjs --check  只校验仓库里的文件是否最新（CI 用）
 *
 * 输出必须**确定性**：同样的输入产出逐字节相同的文件，否则
 * `contentBuildId()` 会天天变、增量部署失效（见 next.config.mjs 的长注释）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'nav.json');

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const categories = read('data/categories.json');
const tags = read('data/tags.json');
const featured = read('data/featured.json');
const tools = read('data/tools.json');

const toolSlugs = new Set(tools.map((t) => t.slug));

/**
 * 分类：客户端只需要「能画出图标并用色相区分」的字段。
 * `tailwind` 保留 —— 侧栏与下拉都直接把它拼进 className（`text-orange-600`），
 * 而它是 safelist 放行过的 22 色相 × 4 档之一（见 tailwind.config.ts）。
 */
const navCategories = categories.map((c) => ({
  slug: c.slug,
  name: c.name,
  icon: c.icon,
  color: c.color,
  tailwind: c.tailwind,
  hot: Boolean(c.hot),
}));

/**
 * 常用推荐：href 在构建期解析。
 * 规则与 `lib/data.ts` 的 `featured` 完全一致：在目录中 → `/tools/{slug}`，
 * 否则退回 `external`（没有 external 时仍用 `/tools/{slug}`，由 404 兜底）。
 */
const navFeatured = featured.map((t) => ({
  slug: t.slug,
  name: t.name,
  description: t.description ?? '',
  icon: t.icon ?? '',
  href: toolSlugs.has(t.slug) ? `/tools/${t.slug}` : (t.external ?? `/tools/${t.slug}`),
}));

const navTags = tags.map((t) => ({
  slug: t.slug,
  name: t.name,
  iconUrl: t.iconUrl ?? '',
}));

/** 键顺序写死，保证逐字节可复现。 */
const payload = {
  categories: navCategories,
  featured: navFeatured,
  tags: navTags,
};

const json = JSON.stringify(payload) + '\n';
const check = process.argv.includes('--check');

if (check) {
  if (!existsSync(OUT)) {
    console.error('data/nav.json 不存在，先跑 npm run gen:nav');
    process.exit(1);
  }
  if (readFileSync(OUT, 'utf8') !== json) {
    console.error('data/nav.json 与数据源不一致，跑 npm run gen:nav 重新生成');
    process.exit(1);
  }
  console.log('nav.json 已是最新');
} else {
  writeFileSync(OUT, json);
  const kb = (Buffer.byteLength(json) / 1024).toFixed(1);
  console.log(
    `nav.json 写入完成：${navCategories.length} 分类 / ${navFeatured.length} 推荐 / ${navTags.length} 标签，${kb} KB`,
  );
}
