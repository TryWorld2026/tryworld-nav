import type { Metadata } from 'next';
import { ToolsExplorer } from '@/components/tools-explorer';
import { PageHeader } from '@/components/page-header';
import { allCategories, extrasBySlug, tags, tools } from '@/lib/data';
import { canonical } from '@/lib/canonical';

export const metadata: Metadata = {
  ...canonical('/tools'),
  title: '全部工具',
  description: '浏览试界导航收录的所有 AI 工具与智能体，支持按分类、标签和关键词筛选。',
};

/**
 * Statically exported — the filter state comes from the URL on the client (see
 * `ToolsExplorer`), so this component takes no `searchParams`. That is what
 * keeps `/tools?q=…` working on a host with no server behind it.
 *
 * 2026-10-18：传给客户端的 `tools` 做了**字段瘦身**。原先整个 `Tool` 对象
 * （含 `image`（每条约 55 字符的截图路径）、`variant`、`link`、`rawName` 等
 * 卡片根本用不到的字段）都被序列化进 HTML —— `/tools` 的 HTML 因此有
 * 1.16 MB，DCL 512ms。卡片只需要 slug/name/description/icon/tags/categories。
 *
 * `freeSlugs` 是「只看免费」筛选用的一份白名单：价格在 `tool-extras.json`
 * 里，客户端没有那个 14 MB 文件，所以服务端算好一个 slug 数组传下去。
 * 免费 183 + 免费开源 55 = 238 个，序列化后约 5 KB。
 */
export default function ToolsPage() {
  const slim = tools.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    icon: t.icon,
    tags: t.tags,
    categories: t.categories,
  }));

  const freeSlugs = tools
    .filter((t) => {
      const pricing = extrasBySlug(t.slug)?.pricing;
      return pricing === '免费' || pricing === '免费开源';
    })
    .map((t) => t.slug);

  return (
    <div className="content-container space-y-7 py-8 md:py-10">
      <PageHeader
        eyebrow="工具目录"
        title="全部工具"
        description={`共收录 ${tools.length} 个 AI 工具与智能体，覆盖 ${allCategories.length} 个分类。按分类、标签或关键词筛选。`}
      />
      <ToolsExplorer
        tools={slim as never}
        categories={allCategories}
        tags={tags}
        freeSlugs={freeSlugs}
      />
    </div>
  );
}
