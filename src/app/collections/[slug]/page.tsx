import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { collectionBySlug, collections, SITE, toolBySlug } from '@/lib/data';
import { ToolMiniCard } from '@/components/tool-card';
import { CategoryGrid } from '@/components/category-grid';
import { cardFromTool } from '@/lib/card-server';
import type { Tool } from '@/lib/types';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export function generateStaticParams() {
  return collections.map((c) => ({ slug: c.slug }));
}

/**
 * The origin's `<title>` is `{title}大全 | {站点名}`, so — as on the tool page —
 * it must be returned absolute to defeat `layout.tsx`'s `title.template`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = collectionBySlug.get(slug);
  if (!collection) return { title: '集合未找到' };

  const title = `${collection.title}大全 | ${SITE.name}`;
  return withOg(
    {
      ...canonical(`/collections/${slug}`),
      title: { absolute: title },
      description: collection.intro,
    },
    `/collections/${slug}`,
    { image: collection.tagIcon },
  );
}

/**
 * The origin's collection detail page, verbatim from its flushed SSR payload.
 *
 * Three sections: the tag-icon header, the member grid, then 其他集合. The
 * member grid is the same magic-border card the 更多AI工具 grid uses — only the
 * chip row differs, where the origin swaps category chips (a coloured dot plus
 * the name) for tag chips (a 16×16 tag icon plus the name). That swap is why
 * `ToolMiniCard` takes a `chips` prop instead of owning its chip markup.
 */
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = collectionBySlug.get(slug);
  if (!collection) notFound();

  // Members are harvested as slugs; resolve them against the catalog so the card
  // gets the icon, name and summary the origin shows. A member missing from the
  // catalog would otherwise crash the whole page during prerender.
  const members = collection.tools
    .map((m) => {
      const tool = toolBySlug.get(m.slug);
      if (!tool) return null;
      // The card's `categories` row is replaced by `chips`, so the member's own
      // category chips are suppressed rather than rendered underneath.
      return { member: m, tool: tool as Tool };
    })
    .filter((x): x is { member: (typeof collection.tools)[number]; tool: Tool } => x !== null);

  const others = collection.others
    .map((s) => collectionBySlug.get(s))
    .filter((c): c is (typeof collections)[number] => Boolean(c));

  return (
    <>
      <div className="border-b border-foreground/10 bg-background py-9 md:py-11">
        <div className="content-container">
          {/* 分类详情页头之下就有一条「返回所有分类」。合集详情原先只有
              正文末尾那个按钮，读完一屏才够得着；两页都是「列表 → 详情」，
              出口应该在同一处。样式与 `categories/[slug]` 保持一致。 */}
          <div className="mb-6">
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
              返回所有集合
            </Link>
          </div>
          {/* 与 `categories/[slug]` 同一副刊头：标题块在左，计数块钉在右缘
              （那一页的注释写了为什么要把计数从眉标里搬出来 —— 2560 下页头
              右侧 1447px 全空，而下面是一条通栏发丝线 + 满宽网格）。两页
              共用一副骨架，改一处就得改另一处，否则从分类切到集合时页头又
              换了一套排版。 */}
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.035] ring-1 ring-inset ring-foreground/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={collection.tagIcon}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-10 object-contain"
                />
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  精选集合
                </p>
                <h1 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
                  {collection.title}
                </h1>
                <p className="mt-2.5 max-w-[62ch] text-[15px] leading-relaxed text-gongke-muted">
                  {collection.intro}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-baseline gap-1.5 md:border-l md:border-foreground/10 md:pl-8">
              <span className="font-display text-xl leading-none tabular-nums text-foreground md:text-2xl">
                {members.length}
              </span>
              <span className="text-xs text-muted-foreground">个工具</span>
            </div>
          </div>
        </div>
      </div>

      <div className="py-8">
        <div className="content-container">
          {/* 2026-10-22：网格换成客户端组件 `CategoryGrid`，与分类页共用同一套
              排序 + 加载更多。集合页原先 20 条一次全铺、无排序无分页 ——
              而「在这里挑工具」正需要排序。

              卡片用自己的 `chips`（集合的标签 chip），所以传 `chipsBySlug`
              数据而不是渲染函数（客户端组件不能收函数 prop）。`cardFromTool()`
              仍必须在服务端先过一遍，否则裸 `Tool` 没有价格/平台/更新时间，
              卡片底部那条「可比较的事实」会整块不渲染。 */}
          <CategoryGrid
            cards={members.map(({ tool }) => cardFromTool(tool))}
            chipsBySlug={
              new Map(
                members.map(({ member }) => [
                  member.slug,
                  member.tags.map((g) => ({ slug: g.slug, name: g.name, icon: g.icon })),
                ]),
              )
            }
          />
        </div>
      </div>

      {others.length > 0 && (
        <div className="border-t border-foreground/10 py-10">
          <div className="content-container">
            <h2 className="mb-4 text-[19px] font-semibold text-foreground">其他集合</h2>
            {/* 每个集合的 `others` 恰好 3 项（9 个集合互指），所以列数只能取
                3 的约数：sm 2 列（2+1，读作「一共三个」）→ lg 起 3 列一行
                排满。原先写的是 lg:grid-cols-4 —— 在 ≥1024 上永远空着第四
                格，三张卡片靠左挤成 3/4 宽的一条，右边留给一片什么都没有的
                白；这和页面底部「其他分类」「其他集合」的整行铺满不是一套
                语言。卡片是「图标 + 两行字」的横卡，1440 下 394px 一列很
                宽松，不必为了更密而缩到 4 列。 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((o) => (
                <Link
                  key={o.slug}
                  href={`/collections/${o.slug}`}
                  className="group flex items-start gap-3 rounded-xl border border-foreground/10 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md active:translate-y-0"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.035] ring-1 ring-inset ring-foreground/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={o.tagIcon}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-8 object-contain"
                    />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-gongke-accent">
                      {o.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-gongke-muted">
                      {o.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/collections"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gongke-dark px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-gongke-dark/90 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
              >
                查看所有集合
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
