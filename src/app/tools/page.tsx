import type { Metadata } from 'next';
import { ToolsExplorer } from '@/components/tools-explorer';
import { PageHeader } from '@/components/page-header';
import { allCategories, extrasBySlug, tags, tools } from '@/lib/data';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
    ...canonical('/tools'),
    title: '全部工具',
    description:
      '浏览试界导航收录的所有 AI 工具与智能体，支持按分类、标签、价格、平台筛选，可按最近更新排序。',
  },
  '/tools',
);

/**
 * Statically exported — the filter state comes from the URL on the client (see
 * `ToolsExplorer`), so this component takes no `searchParams`. That is what
 * keeps `/tools?q=…` working on a host with no server behind it.
 *
 * 2026-10-22：这个页面**不再向客户端序列化任何工具数据**。
 *
 * 上一版把 2081 个 `Tool` 瘦身后传下去（去掉 `image`/`variant`/`link`），
 * HTML 仍有 1.16 MB。现在 `ToolsExplorer` 自己从 `data/search-index.json`
 * 解出 `CATALOG_INDEX` 取数 —— 那份索引本来就要下发做搜索（br 59 KB），
 * 于是同一份数据不再付两次钱，这个页面交给客户端的只剩 26 个分类与 9 个标签
 * （约 6 KB）。
 *
 * 代价是 `ToolsExplorer` 的 props 变了，服务端**只**传筛选器自己的 UI 数据。
 */
export default function ToolsPage() {
  return (
    <div className="content-container space-y-7 py-8 md:py-10">
      <PageHeader
        eyebrow="工具目录"
        title="全部工具"
        description={`共收录 ${tools.length} 个 AI 工具与智能体，覆盖 ${allCategories.length} 个分类。按分类、标签、价格或平台筛选，也可以按最近更新排序。`}
      />
      <ToolsExplorer categories={allCategories} tags={tags} />
    </div>
  );
}
