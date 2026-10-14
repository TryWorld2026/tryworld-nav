import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { collectionBySlug, collections, SITE, toolBySlug } from '@/lib/data';
import { ToolMiniCard } from '@/components/tool-card';
import type { Tool } from '@/lib/types';
import { canonical } from '@/lib/canonical';

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
  return {
    ...canonical(`/collections/${slug}`),
    title: { absolute: title },
    description: collection.intro,
    openGraph: {
      type: 'website',
      title,
      description: collection.intro,
      images: collection.tagIcon ? [{ url: collection.tagIcon }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: collection.intro,
      images: collection.tagIcon ? [collection.tagIcon] : undefined,
    },
  };
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
      <div className="pt-10 bg-background">
        <div className="px-4 sm:px-8 mx-auto">
          <div className="mb-6">
            <div className="w-14 h-14 rounded-full mb-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={collection.tagIcon}
                alt={collection.title}
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
                className="object-contain rounded-lg"
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 font-display">{collection.title}</h1>
          </div>
          <div className="max-w-3xl">
            <p className="text-gongke-muted leading-relaxed">{collection.intro}</p>
          </div>
        </div>
      </div>

      <div className="py-8">
        <div className="px-4 sm:px-8 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8 gap-6">
            {members.map(({ member, tool }) => (
              <ToolMiniCard
                key={tool.slug}
                tool={tool}
                emphasis
                // Always the tag-chip row, wrapper included — even when a member
                // carries no tags. The origin renders the empty flex row rather
                // than falling back to category chips, and `chips` is what
                // suppresses the card's default category row.
                chips={
                  <div className="flex flex-nowrap overflow-x-clip text-nowrap gap-1 mt-1.5">
                    {member.tags.map((g) => (
                      <span
                        key={g.slug}
                        className="text-xs text-foreground/60 border border-foreground/5 rounded-md px-1 py-0.5 shadow-sm inline-flex min-w-fit items-center gap-1"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={g.icon}
                          alt={g.name}
                          width={16}
                          height={16}
                          loading="lazy"
                          decoding="async"
                          className="rounded"
                        />
                        {g.name}
                      </span>
                    ))}
                  </div>
                }
              />
            ))}
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div className="py-4">
          <div className="px-4 sm:px-8 mx-auto">
            <h2 className="text-2xl font-bold mb-8 font-display">其他集合</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8 gap-6">
              {others.map((o) => (
                <Link key={o.slug} href={`/collections/${o.slug}`} className="block group">
                  <div className="bg-white rounded-lg border border-magicborder overflow-hidden hover:shadow-sm transition-shadow p-4">
                    <div className="flex items-start">
                      <div className="w-12 h-12 rounded-lg mr-5 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={o.tagIcon}
                          alt={o.title}
                          width={48}
                          height={48}
                          loading="lazy"
                          decoding="async"
                          className="object-contain rounded-lg"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-1 group-hover:text-gongke-accent transition-colors">
                          {o.title}
                        </h3>
                        <p className="text-gongke-muted text-sm">{o.description}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/collections">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 shadow h-9 px-4 py-2 bg-gongke-dark text-white hover:bg-gongke-dark/90"
                >
                  查看所有集合
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
