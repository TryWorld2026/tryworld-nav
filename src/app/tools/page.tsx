import type { Metadata } from 'next';
import { ToolsExplorer } from '@/components/tools-explorer';
import { PageHeader } from '@/components/page-header';
import { allCategories, tags, tools } from '@/lib/data';
import { canonical } from '@/lib/canonical';

export const metadata: Metadata = {
  ...canonical("/tools"),
  title: '全部工具',
  description: '浏览试界导航收录的所有 AI 工具与智能体，支持按分类、标签和关键词筛选。',
};

/**
 * Statically exported — the filter state comes from the URL on the client (see
 * `ToolsExplorer`), so this component takes no `searchParams`. That is what
 * keeps `/tools?q=…` working on a host with no server behind it.
 */
export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="全部工具"
        description={`共收录 ${tools.length} 个 AI 工具与智能体，覆盖 ${allCategories.length} 个分类。`}
      />
      <ToolsExplorer tools={tools} categories={allCategories} tags={tags} />
    </div>
  );
}
