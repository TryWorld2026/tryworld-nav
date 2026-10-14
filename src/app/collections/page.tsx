import type { Metadata } from 'next';
import Link from 'next/link';
import { collections } from '@/lib/data';

export const metadata: Metadata = {
  title: '精选AI利器集合',
  description: '试界导航精选AI工具集合，AI助力提效，让你事半功倍。',
};

/** The origin's headline gradient, verbatim from the flushed SSR payload. */
const HEADLINE_GRADIENT =
  'inline animate-gradient bg-gradient-to-r from-[var(--color-from)] via-[var(--color-to)] to-[var(--color-from)] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent';

export default function CollectionsPage() {
  return (
    <>
      <div className="pt-10">
        <div className="px-4 sm:px-8">
          <div className="max-w-4xl">
            <h1 className="mb-2 text-3xl font-bold font-display md:text-4xl">
              <span
                style={
                  {
                    '--bg-size': '300%',
                    '--color-from': '#ffaa40',
                    '--color-to': '#9c40ff',
                  } as React.CSSProperties
                }
                className={HEADLINE_GRADIENT}
              >
                精选AI利器集合
              </span>
              {' - 工欲善其事，必先利其器'}
            </h1>
            <p className="text-lg text-gongke-muted">
              试界导航精选AI工具集合，AI助力提效，让你事半功倍。
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-10 sm:px-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8">
          {collections.map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="group block">
              <div className="overflow-hidden rounded-lg border border-foreground/5 bg-white p-4 transition-shadow hover:shadow-sm">
                <div className="flex flex-col justify-between">
                  <div className="mb-6">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.tagIcon}
                        alt={c.title}
                        width={48}
                        height={48}
                        loading="lazy"
                        decoding="async"
                        className="rounded-lg object-contain"
                      />
                    </div>
                    <h3 className="mb-1 text-lg font-bold transition-colors group-hover:text-gongke-accent">
                      {c.title}
                    </h3>
                    <p className="line-clamp-2 text-gongke-muted">{c.description}</p>
                  </div>
                  {/* The origin's member strip: up to six tool icons, capped so
                      a six-tool collection and a twenty-tool one render the
                      same height. There is no "+N" counter. */}
                  <div className="flex flex-wrap gap-3 md:items-center md:gap-4">
                    {c.memberIcons.map((src, i) => (
                      <div className="relative h-8 w-8" key={i}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          width={48}
                          height={48}
                          loading="lazy"
                          decoding="async"
                          className="rounded-lg object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
