import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar } from 'lucide-react';
import { newsArticles, newsBySlug, SITE } from '@/lib/data';
import type { NewsArticle } from '@/lib/types';
import { canonical } from '@/lib/canonical';

export function generateStaticParams() {
  return newsArticles.map((a) => ({ slug: a.slug }));
}

/**
 * The origin's `<title>` is `{title} | {站点名}` and its meta description and
 * keywords are hand-written per article, so all three are harvested rather than
 * derived. As on the tool and collection routes, the title comes back absolute:
 * `layout.tsx` sets `title.template` to `%s - {站点名}`, which would append the
 * site name a second time to this string.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = newsBySlug.get(slug);
  if (!article) return { title: '新闻未找到' };

  const title = `${article.title} | ${SITE.name}`;
  return {
    ...canonical(`/news/${slug}`),
    title: { absolute: title },
    description: article.seoDescription || article.summary,
    keywords: article.keywords ? article.keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
    openGraph: {
      type: 'article',
      title,
      description: article.seoDescription || article.summary,
      images: article.cover ? [{ url: article.cover }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: article.seoDescription || article.summary,
      images: article.cover ? [article.cover] : undefined,
    },
  };
}

/**
 * The origin's article page, verbatim from its flushed SSR payload.
 *
 * Three parts: the back link plus the title/meta header, then a `md:grid-cols-3`
 * body holding the cover image and the prose on the left and the 相关新闻 rail on
 * the right.
 *
 * Two client components in the origin's payload carry no server-rendered body
 * and are omitted rather than guessed: the share widget (`articleSlug` + `type`,
 * which opens the origin's own share sheet) and the CodeHighlight wrapper that
 * re-highlights `<pre>` blocks after hydration. The prose HTML itself already
 * contains the code blocks; only their post-hydration re-colouring is missing.
 */
export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = newsBySlug.get(slug);
  if (!article) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow flex">
        <div className="flex-1">
          <div className="bg-background">
            <div className="brand-container pt-6">
              <div className="flex items-center mb-4">
                <Link href="/news">
                  <button
                    type="button"
                    className="justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:bg-background/90 hover:text-foreground h-8 rounded-md px-3 text-xs flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    返回新闻列表
                  </button>
                </Link>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-2xl text-foreground font-bold mb-4">{article.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" aria-hidden="true" />
                      <span>
                        发布时间：
                        <time dateTime={article.dateTime}>{article.dateLabel}</time>
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-light text-secondary-foreground">
                      {article.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 pb-10 brand-container bg-background">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                {article.cover && (
                  <div className="mb-8 rounded-lg overflow-hidden border border-muted">
                    <Image
                      src={article.cover}
                      alt={article.coverAlt}
                      width={800}
                      height={450}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="mb-8">
                  <div className="relative">
                    <div
                      className="prose prose-stone max-w-none px-4 text-foreground/80 prose-headings:mt-4 prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground prose-a:text-gongke-accent hover:prose-a:text-gongke-accent/80 prose-code:bg-gongke-gray/20 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 before:prose-code:content-['']  after:prose-code:content-[''] article-content"
                      dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 space-y-6">
                <RelatedNews article={article} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * The 相关新闻 rail, verbatim. The origin's sidebar is a separate client
 * component, but its markup is static — three links, each a title, a clamped
 * summary and a calendar + date row. The date is hoisted out of the link object
 * by Next.js and cross-filled from the owning article at harvest time (see
 * `NewsRelated`).
 */
function RelatedNews({ article }: { article: NewsArticle }) {
  if (article.related.length === 0) return null;
  return (
    <div className="bg-white backdrop-blur-sm rounded-lg border border-muted p-6">
      <h2 className="text-xl text-foreground font-medium mb-4 font-display">相关新闻</h2>
      <div className="flex flex-col gap-4">
        {article.related.map((r) => (
          <Link key={r.slug} href={r.href} className="group">
            <div>
              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                {r.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{r.summary}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Calendar className="w-3 h-3" aria-hidden="true" />
                <time dateTime={r.dateTime}>{r.dateLabel}</time>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
