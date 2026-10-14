import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock } from 'lucide-react';
import { newsArticles } from '@/lib/data';
import { canonical } from '@/lib/canonical';

export const metadata: Metadata = {
  ...canonical("/news"),
  title: 'AI新闻资讯',
  description: '获取最新的人工智能行业动态、技术趋势和市场资讯。',
};

/**
 * The origin's /news index, verbatim from its flushed SSR payload.
 *
 * Two sections: the `max-w-4xl` header, then the card grid. The grid is
 * `md/lg/xl` only — unlike every other grid on the site it stops at `xl`, with
 * no `2xl+` tiers, so it is transcribed that way rather than copied from the
 * neighbouring routes.
 *
 * The origin also streams a twelve-card `animate-pulse` skeleton ahead of the
 * real grid, using the same card wrapper classes; the replica renders the data
 * directly and drops it. See the deviation list in README/DEVIATIONS.
 */
export default function NewsIndexPage() {
  return (
    <>
      <div className="bg-background pt-8 px-2">
        <div className="px-2 sm:px-8">
          <div className="max-w-4xl">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 font-display">AI新闻资讯</h1>
            <p className="text-gongke-muted text-lg mb-8">获取最新的人工智能行业动态、技术趋势和市场资讯。</p>
          </div>
        </div>
      </div>

      <div className="pt-2 pb-8 px-4 md:px-8 min-h-screen">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {newsArticles.map((a) => (
            <div
              key={a.slug}
              className="rounded-xl border bg-card text-card-foreground shadow overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src={a.image}
                  alt={a.alt}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>

              <div className="flex flex-col space-y-1.5 p-6 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-light text-secondary-foreground">
                    {a.category}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" aria-hidden="true" />
                    {a.date}
                  </div>
                </div>
                <div className="font-semibold tracking-tight line-clamp-2 text-lg">
                  <Link href={a.href} className="hover:text-primary transition-colors">
                    {a.title}
                  </Link>
                </div>
              </div>

              <div className="p-6 pt-0">
                <div className="text-sm text-muted-foreground line-clamp-3">{a.summary}</div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {a.dateShort}
                  </div>
                  <Link href={a.href} className="text-sm text-primary hover:underline">
                    {a.readMore}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
