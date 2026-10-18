import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CategoryIcon } from '@/components/category-icon';
import { TOOL_GRID, ToolMiniCard } from '@/components/tool-card';
import { categories, categoryBySlug, categoryCards, SITE, toolsByCategory } from '@/lib/data';
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
  // 分类卡里那行一句话简介（`category-cards.json` 的 tagline）在 `categories.json`
  // 里没有，但详情页正缺一句「这个分类是什么」—— 列表页上读者刚看过它。
  const card = categoryCards.find((c) => c.slug === slug);

  return (
    <>
      {/* 页头与 `collections/[slug]` 用同一副骨架：通栏浅色带 + 返回链接 +
          56px 图标块 + 眉标 + 3xl/4xl 标题。两页都是「列表 → 详情」，
          原先一页内联、一页通栏，标题还差一档（2xl/3xl vs 3xl/4xl），
          从分类切到集合时整个第一屏忽然换了一套排版。 */}
      <div className="border-b border-foreground/10 py-9 md:py-11">
        <div className="content-container">
          <div className="mb-6">
            <Link
              href="/categories"
              className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
              返回所有分类
            </Link>
          </div>
          {/* 计数从眉标里搬出来，单独落在右缘。
              眉标里那句「场景 · 161 个工具」只有 130px 宽，页头文字块整体
              ~450px，2560 下右侧 1447px 全空 —— 下面却是一条铺满全宽的
              发丝线 + 五列卡片网格，「页头塌、内容满」的落差在这一页比
              /tools 还明显。把数字提到右缘后，页头的左右两个锚点分别是
              标题块与计数块，中间的空带读作刊头留白；计数块的右缘与下方
              网格的右缘同线，整页收在一条竖直边上。
              字号只取 `text-xl md:text-2xl`：这一页 h1 是 30/36px，计数若
              照抄 /categories 的 `text-2xl md:text-3xl`（24/30）会和标题
              同档，两级层次塌成一级。 */}
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-foreground/5"
                style={{ background: rgbAlpha(category.color, 0.1), color: rgb(category.color) }}
              >
                <CategoryIcon name={category.icon} className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  场景
                </p>
                <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
                  {category.name}
                </h1>
                {card?.tagline && (
                  <p className="mt-2.5 max-w-[62ch] text-[15px] leading-relaxed text-gongke-muted">
                    {card.tagline}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-baseline gap-1.5 md:border-l md:border-foreground/10 md:pl-8">
              <span className="font-display text-xl leading-none tabular-nums text-foreground md:text-2xl">
                {list.length}
              </span>
              <span className="text-xs text-muted-foreground">个工具</span>
            </div>
          </div>
        </div>
      </div>

      {/* 这一页原来没有内容容器：标题紧贴侧栏右缘（1920 下 h1 左缘 264px，
          比站内任何一页都靠左 130px），而网格又是满宽的 —— 宽屏上标题与卡片
          左边界相差 70px 以上。现在统一走 `.content-container`。 */}
      <div className="content-container space-y-8 py-8 md:py-10">
        {list.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            该分类下暂无工具。
          </div>
        ) : (
          /* The origin's category pages use the same magic-border mini card as the
             home page and /tools — counted 241 mini cards and zero large ones on
             /categories/ai-agents.

             与首页 / /tools 共用 `TOOL_GRID`：全站卡片宽度由 280px 最小轨道
             决定，从首页点进分类页时字号与密度不会突然变一档。 */
          <div className={TOOL_GRID}>
            {list.map((t) => (
              <ToolMiniCard key={t.id} tool={t} hideCategorySlug={slug} />
            ))}
          </div>
        )}

        <section className="border-t border-foreground/10 pt-10">
          {/* 页底横带标题统一 19px（与「其他集合」「全部往期」同档）。
              原来这里是 14px，读起来像筛选器旁边的小标签，而不是一条新的
              内容带的开头。 */}
          <h2 className="mb-4 text-[19px] font-semibold text-foreground">其他分类</h2>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.slug !== slug)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-all duration-150 hover:-translate-y-px hover:border-foreground/20 hover:text-foreground"
                >
                  <CategoryIcon name={c.icon} className="h-3 w-3" />
                  {c.name}
                </Link>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}
