import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { CategoryIcon } from '@/components/category-icon';
import { ToolMiniCard } from '@/components/tool-card';
import { categories, categoryBySlug, SITE, toolsByCategory } from '@/lib/data';
import { canonical } from '@/lib/canonical';
import { rgb, rgbAlpha } from '@/lib/utils';

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryBySlug.get(slug);
  if (!category) return { title: '分类未找到' };
  return {
    ...canonical(`/categories/${slug}`),
    // Absolute, not a bare string: `layout.tsx` sets `title.template`, which
    // would append the site name a second time.
    title: { absolute: `${category.name} - ${SITE.name}` },
    description: `浏览 ${category.name} 分类下的 AI 工具与智能体。`,
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = categoryBySlug.get(slug);
  if (!category) notFound();

  const list = toolsByCategory(slug);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/categories"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回所有分类
        </Link>
      </div>

      <div className="flex items-center gap-4 border-b border-border pb-6">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
          style={{ background: rgbAlpha(category.color, 0.12), color: rgb(category.color) }}
        >
          <CategoryIcon name={category.icon} className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {list.length} 个工具
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          该分类下暂无工具。
        </div>
      ) : (
        /* The origin's category pages use the same magic-border mini card as the
           home page and /tools — counted 241 mini cards and zero large ones on
           /categories/ai-agents. */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 4xl:grid-cols-7 5xl:grid-cols-8">
          {list.map((t) => (
            <ToolMiniCard key={t.id} tool={t} />
          ))}
        </div>
      )}

      <section className="border-t border-border pt-8">
        <h2 className="mb-4 text-sm font-semibold text-foreground">其他分类</h2>
        <div className="flex flex-wrap gap-2">
          {categories
            .filter((c) => c.slug !== slug)
            .map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <CategoryIcon name={c.icon} className="h-3 w-3" />
                {c.name}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
