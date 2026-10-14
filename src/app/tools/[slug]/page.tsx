import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Timer } from 'lucide-react';
import { notFound } from 'next/navigation';

import { AdSlot } from '@/components/ad-slot';
import { CategoryIcon } from '@/components/category-icon';
import { ToolActions } from '@/components/tool-actions';
import { ToolInfoPanel } from '@/components/tool-info-panel';
import { ToolMiniCard, ToolRowCard } from '@/components/tool-card';
import { ToolProse } from '@/components/tool-details';
import {
  SITE,
  extrasBySlug,
  latestAdditions,
  moreTools,
  relatedTools,
  toolBySlug,
  tools,
} from '@/lib/data';
import { pricingBadgeClass } from '@/lib/pricing';
import { buttonPrimary } from '@/lib/styles';

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

/**
 * The origin's `<title>` is `{name} - {tagline} | {站点名}`, which is NOT what
 * `layout.tsx`'s `title.template` (`%s - {站点名}`) would produce from a bare
 * string — the template would append the site name a second time. Returning the
 * absolute string defeats the template, which is the only way to get the
 * origin's exact form.
 *
 * The meta description is the origin's own long SEO paragraph, harvested per
 * page. It is a separate hand-written blurb — not the short tagline from
 * `tools.json` and not the first paragraph of `prose` — so it cannot be
 * synthesised; see `description` on `ToolExtras`. Two slugs (deta-surf,
 * hyperspace) ship no blurb on the origin either and fall back to the tagline.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug.get(slug);
  if (!tool) return { title: '工具未找到' };

  const extras = extrasBySlug(slug);
  const description = extras?.description || tool.description;

  return {
    // Absolute, not a bare string — see the note above about `title.template`.
    title: { absolute: `${tool.name} - ${tool.description} | ${SITE.name}` },
    description,
    keywords: [
      tool.name,
      `${tool.name}官网`,
      `${tool.name}官网入口`,
      `${tool.name}下载`,
      `${tool.name}网页版`,
    ],
    openGraph: {
      type: 'website',
      title: `${tool.name} - ${tool.description} | ${SITE.name}`,
      description,
      images: tool.image ? [{ url: tool.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tool.name} - ${tool.description} | ${SITE.name}`,
      description,
      images: tool.image ? [tool.image] : undefined,
    },
  };
}

/**
 * `更新于2025年10月11日` — the origin formats the timestamp with the browser's
 * local timezone, which would make a prerendered page differ per viewer. The
 * UTC getters keep the build deterministic; the alternative (rendering the
 * viewer's own date) is not reproducible and not what a static replica wants.
 */
function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = toolBySlug.get(slug);
  if (!tool) notFound();

  const extras = extrasBySlug(slug);
  const primary = tool.categories[0];
  const pricingClass = pricingBadgeClass(extras?.pricing);
  const updatedLabel = extras?.updated ? formatUpdated(extras.updated) : '';

  return (
    <>
      {/* ── Hero band ────────────────────────────────────────────────────
          Full-bleed, closed by a hairline border. `brand-container` is the
          origin's own width token and appears on the tool page only — the
          home, listing and category pages do not use it. */}
      <div className="border-b border-foreground/5 bg-background">
        <div className="brand-container py-8">
          <div className="mb-6 flex flex-col items-start justify-between md:flex-row md:items-center">
            <div className="flex items-center">
              <div className="mr-5 h-14 w-14 flex-shrink-0">
                {tool.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tool.icon}
                    alt={tool.name}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-full w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-foreground/5 text-xl font-bold">
                    {tool.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {tool.name}
                </h1>
                <p className="text-gongke-muted">{tool.description}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-start space-y-3 md:mt-0 md:flex-row md:items-center md:space-x-3 md:space-y-0">
              <ToolActions
                slug={tool.slug}
                name={tool.name}
                description={tool.description}
              />
              {/* 访问官网 — the origin links straight to the product's own
                  site, harvested per entry. The earlier Bing search button
                  was a placeholder and is gone. */}
              <a
                href={extras?.external ?? `/tools/${tool.slug}`}
                target="_blank"
                rel="nofollow noopener noreferrer"
              >
                <button type="button" className={buttonPrimary}>
                  <span>访问官网</span>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </button>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {pricingClass && (
              <div>
                <span className={pricingClass}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1 h-4 w-4"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="6" />
                  </svg>
                  {extras?.pricing}
                </span>
              </div>
            )}

            {/* One pill only — the origin renders the primary category, not
                every category the entry carries. */}
            {primary && (
              <Link href={`/categories/${primary.slug}`}>
                <div className="flex items-center gap-1 rounded-full bg-foreground/5 px-3 py-1 text-sm text-gray-500 transition-colors hover:bg-foreground/10">
                  <CategoryIcon name={primary.icon} className="h-4 w-4" />
                  {primary.name}
                </div>
              </Link>
            )}

            {updatedLabel && (
              <div className="flex items-center gap-1 rounded-full bg-foreground/5 px-3 py-1 text-sm text-gray-500 transition-colors hover:bg-foreground/10">
                <Timer width={16} height={16} aria-hidden="true" />
                <time dateTime={extras?.updated}>{`更新于${updatedLabel}`}</time>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body band ───────────────────────────────────────────────────
          Two columns on md+, the rail taking one of three. */}
      <div className="brand-container bg-background py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            {tool.image && (
              <div className="mb-8 overflow-hidden rounded-lg border border-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tool.image}
                  alt={`${tool.name} 截图`}
                  width={800}
                  height={450}
                  loading="lazy"
                  className="h-auto w-full"
                />
              </div>
            )}

            {/* The origin published no 产品介绍 body at all for three slugs
                (d-id, rabbitos-intern, youchuan); their extras entry exists
                only to carry the 相关信息 rows, so the block is skipped
                rather than rendered as an empty prose box. */}
            {extras && extras.prose ? <ToolProse prose={extras.prose} /> : null}

            {/* Inert placeholder — the origin's real AdSense unit
                (ca-pub-3128385017768065 / 2176275884) is deliberately not
                shipped; see AdSlot. */}
            <AdSlot slot="2176275884" className="mb-4 mt-8 w-full" />

            <div className="px-4 tool-details">
              <h2 className="mb-6 font-display text-2xl font-bold">更多AI工具</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {moreTools(tool.slug, 18).map((t) => (
                  <ToolMiniCard tool={t} key={t.slug} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 md:col-span-1">
            <div className="rounded-lg bg-transparent">
              <div className="adsense-container">
                <AdSlot slot="3461578336" />
              </div>
            </div>

            <ToolInfoPanel
              info={extras?.info ?? []}
              platforms={extras?.platforms ?? []}
            />

            <div className="rounded-lg border border-muted bg-white p-6 backdrop-blur-sm">
              <h2 className="mb-4 font-display text-xl font-medium">类似工具</h2>
              <div className="grid grid-cols-2 gap-4">
                {relatedTools(tool.slug, 10).map((t) => (
                  <ToolRowCard tool={t} key={t.slug} />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-muted bg-white p-6 backdrop-blur-sm">
              <h2 className="mb-4 font-display text-xl font-medium">最新收录</h2>
              <div className="grid grid-cols-2 gap-4">
                {latestAdditions.map((t) => (
                  <ToolRowCard tool={t} key={t.slug} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
