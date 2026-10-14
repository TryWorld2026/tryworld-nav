import Link from 'next/link';
import type { Metadata } from 'next';
import { ConciergeBell, Link2, Rocket } from 'lucide-react';
import { Hero } from '@/components/hero';
import { CategoryIcon } from '@/components/category-icon';
import { SectionHeader } from '@/components/section-header';
import { ToolMiniCard } from '@/components/tool-card';
import { friendLinks, hotTools, newestTools, sections, SITE } from '@/lib/data';
import type { Tool } from '@/lib/types';
import { canonical } from '@/lib/canonical';

/**
 * The home page needs its own metadata block purely for `alternates.canonical`,
 * which is the one path every other route on the site now carries. `title` and
 * `description` are restated from `SITE` because a page-level block overrides
 * the layout's inherited values wholesale — omitting them would drop the
 * description and the keywords-adjacent fields from `/` only.
 */
export const metadata: Metadata = {
  ...canonical("/"),
  title: SITE.title,
  description: SITE.description,
};

/** The origin's phone-only "browse everything" button, verbatim (chunk `62:`). */
const BROWSE_ALL_CLASS =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 shadow h-9 px-4 py-2 bg-gongke-dark text-white hover:bg-gongke-dark/90 w-full sm:w-auto';

/**
 * The origin's mini card, which is what every grid on this page uses. `emphasis`
 * exists because the sections do not share one hover shadow: 最新添加 is the
 * only one that lifts to `shadow-md`; 热门工具 and all 26 category sections use
 * `shadow-sm`. Counted directly out of the flushed SSR HTML — 10/10, 7/7 and
 * 5/5 cards respectively, with no exceptions.
 */
function Grid({ items, emphasis = false }: { items: Tool[]; emphasis?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 4xl:grid-cols-7 5xl:grid-cols-8">
      {items.map((t) => (
        <ToolMiniCard key={t.id} tool={t} emphasis={emphasis} />
      ))}
    </div>
  );
}

export default function HomePage() {
  // The origin's home page is one <section> holding four things in order: the
  // hot rail, the newest rail, 26 category rails, then the phone-only button —
  // with the friend-links strip after all of it, outside the section. The two
  // rails are harvested slug lists (data/home-rails.json) rather than a slice
  // of the catalog: 热门工具 is a hand-picked 10 and 最新添加 is 25, and neither
  // is derivable from tools.json's order.
  return (
    <>
      <Hero />

      <section className="bg-background p-4">
        <div className="px-4">
          <div className="mb-12">
            <SectionHeader
              title="热门工具"
              href="/tools"
              linkLabel="查看全部"
              icon={<Rocket className="h-5 w-5" />}
            />
            <Grid items={hotTools} />
          </div>

          {/* 最新添加 has no "查看更多" control on the origin — it is the only
              home-page section that leads nowhere, so no href is passed here. */}
          <div>
            <SectionHeader
              title="最新添加"
              icon={<ConciergeBell className="h-5 w-5" />}
            />
            <Grid items={newestTools} emphasis />
          </div>

          {sections.map((s) => (
            <div className="mt-8 space-y-4" key={s.slug}>
              <SectionHeader
                title={s.name}
                id={s.slug}
                href={`/categories/${s.slug}`}
                icon={<CategoryIcon name={s.icon} className="h-5 w-5" />}
                compact
              />
              <Grid items={s.tools} />
            </div>
          ))}

          <div className="mt-8 text-center md:hidden">
            <Link href="/tools" className={BROWSE_ALL_CLASS}>
              浏览全部工具
            </Link>
          </div>
        </div>
      </section>

      {/* Last element in the origin's body — the `$RS("S:2","P:2")` flush lands
          immediately after it, and P:1/P:2 are the shell's document-order
          placeholders, so nothing follows. */}
      <div className="hidden px-4 text-sm text-muted-foreground md:mt-4 md:block sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Link2 className="h-4 w-4" />
          <span>友情链接</span>
          {friendLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
            >
              {l.name}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
