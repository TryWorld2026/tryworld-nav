import Link from 'next/link';
import { Layers2, Sparkles } from 'lucide-react';
import { CategoryIcon } from './category-icon';
import { SiteLogo } from './site-logo';
import { featured, hotCategories, SITE } from '@/lib/data';
import { cn } from '@/lib/utils';

/**
 * The origin's fixed sidebar, transcribed from its markup.
 *
 * The origin hardcodes this whole panel in the component — the rows are not
 * derived from the category payload — so the replica does the same rather than
 * trying to make `categories.json` drive it. What the payload still supplies is
 * the icon glyph and the base label/tone for each row, which keeps the two in
 * step for the 11 of 18 rows where the origin agrees with it.
 *
 * The order below is the origin's own, which is NOT `categories.json`'s
 * `order`: the origin swaps `ai-data-analysis` and `ai-search-engine` relative
 * to it. That is reproduced rather than corrected.
 *
 * Every place the origin's hardcoded value disagrees with the payload is listed
 * in SIDEBAR_PRESENTATION instead of being silently applied, so the divergence
 * is reviewable in one place:
 *
 *   label  ai-writing                 AI写作      -> AI文章写作
 *   label  ai-coding                  AI代码编程  -> AI编程代码
 *   tone   ai-agents                  amber-500   -> rose-500
 *   tone   ai-coding                  stone-500   -> slate-500
 *   tone   ai-ppt                     teal-500    -> violet-500
 *   tone   ai-browser                 pink-500    -> yellow-500
 *   tone   ai-mindmap-whiteboard      sky-500     -> blue-500
 *   tone   ai-content-detection       indigo-500  -> purple-500
 *   tone   ai-prompt-tools            blue-700    -> emerald-500
 *   tone   ai-recruiting-tools        indigo-600  -> violet-600
 *   tone   ai-lawer-tools             yellow-400  -> yellow-500
 *
 * The 18 icon names match the payload exactly, so those stay data-driven.
 */

/** The origin's sidebar order. Icons, labels and tones are joined in by slug. */
const SIDEBAR_SLUGS = [
  'ai-agents',
  'ai-chatbots',
  'ai-writing',
  'ai-image-design',
  'ai-video-animation',
  'ai-audio-music',
  'ai-coding',
  'ai-data-analysis',
  'ai-search-engine',
  'ai-ppt',
  'ai-browser',
  'ai-mindmap-whiteboard',
  'ai-content-detection',
  'ai-academic-tools',
  'ai-cloud-platforms',
  'ai-prompt-tools',
  'ai-recruiting-tools',
  'ai-lawer-tools',
] as const;

/** Rows where the origin's hardcoded label/tone beats the payload's. */
const SIDEBAR_PRESENTATION: Record<string, { name?: string; tailwind?: string }> = {
  'ai-writing': { name: 'AI文章写作' },
  'ai-coding': { name: 'AI编程代码', tailwind: 'text-slate-500' },
  'ai-agents': { tailwind: 'text-rose-500' },
  'ai-ppt': { tailwind: 'text-violet-500' },
  'ai-browser': { tailwind: 'text-yellow-500' },
  'ai-mindmap-whiteboard': { tailwind: 'text-blue-500' },
  'ai-content-detection': { tailwind: 'text-purple-500' },
  'ai-prompt-tools': { tailwind: 'text-emerald-500' },
  'ai-recruiting-tools': { tailwind: 'text-violet-600' },
  'ai-lawer-tools': { tailwind: 'text-yellow-500' },
};

/**
 * The origin labels the sixth 常用推荐 entry "Seko"; `featured.json` carries
 * "Seko AI". One entry, so it is patched here rather than in the data file.
 */
const FEATURED_LABELS: Record<string, string> = { 'seko-ai': 'Seko' };

/**
 * The origin's own classes. Both navs use the same anchor; the category one
 * simply omits `target`/`rel`, which only make sense for off-site links.
 */
const NAV_CLASS =
  'flex items-center py-2 hover:bg-foreground/5 rounded-md px-2 transition-colors';
const LABEL_CLASS = 'text-sm text-foreground/80';
const HEADING_CLASS = 'text-sm font-semibold text-gray-500 mb-4 flex items-center';

export function SiteSidebar() {
  const rows = SIDEBAR_SLUGS.map((slug) => {
    const c = hotCategories.find((x) => x.slug === slug);
    if (!c) return null;
    const override = SIDEBAR_PRESENTATION[slug];
    return {
      slug,
      name: override?.name ?? c.name,
      icon: c.icon,
      // Falls back to the payload's tone for the 8 rows the origin leaves alone;
      // the `text-` prefix is in the data already, so it is used verbatim.
      tailwind: override?.tailwind ?? c.tailwind,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <aside
      className={cn(
        'scrollbar-none hover:scrollbar-thin scrollbar-track-transparent',
        'w-48 border-r border-foreground/5 h-screen p-4 bg-white',
        'hidden lg:block fixed left-0 top-0 bottom-0 overflow-y-auto',
      )}
    >
      {/* The origin pins the brand over the scroll area so the two nav groups
          slide under it. Its width is `calc(14rem-56px)` while the panel is
          `w-48` (12rem) — the calc is a leftover from a wider panel and is kept
          as-is rather than corrected. */}
      <div className="fixed top-0 left-0 w-[calc(14rem-56px)] bg-white p-4 z-10">
        {/* This points at the site root; the replica's home is
            its own root, which is the same destination within this app. The
            origin writes a bare <a>; a <Link> renders identical markup but lets
            Next prefetch and keeps the build's link rule satisfied. */}
        <Link className="flex items-center" href="/">
          {/* 主标是宽幅的（192×116），给宽度 + `h-auto` 保持比例；塞进方形盒
              子会被压扁。`mr-2` 代替原来的方框留出规范要求的「一笔宽度」空白。 */}
          <SiteLogo className="w-8 h-auto text-gongke-dark mr-2" />
          <div className="text-xl text-foreground font-bold font-display">{SITE.name}</div>
        </Link>
      </div>

      <div className="mt-16">
        <div className="mb-8">
          <h2 className={HEADING_CLASS}>
            <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
            常用推荐
          </h2>
          <nav className="space-y-1">
            {featured.map((t) => (
              <Link
                key={t.name}
                href={t.href}
                // The origin sends these to affiliate redirects in a new tab
                // (`target="_blank" rel="nofollow"`). `data.ts` rewrites the href
                // to the replica's own /tools/{slug} when the product is in the
                // catalog, so opening a new tab for it would be wrong; only the
                // genuinely off-site fallbacks keep the origin's attributes.
                {...(t.href.startsWith('http')
                  ? { target: '_blank', rel: 'nofollow' as const }
                  : {})}
                className={NAV_CLASS}
              >
                <div className="w-5 h-5 relative mr-3 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={t.name}
                    loading="lazy"
                    width={20}
                    height={20}
                    decoding="async"
                    className="object-contain rounded"
                    src={t.icon}
                  />
                </div>
                <span className={LABEL_CLASS}>{FEATURED_LABELS[t.slug] ?? t.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="mb-8">
          <h2 className={HEADING_CLASS}>
            <Layers2 className="w-4 h-4 mr-2" aria-hidden="true" />
            热门分类
          </h2>
          <nav className="space-y-1">
            {rows.map((c) => (
              <Link key={c.slug} href={`/categories/${c.slug}`} className={NAV_CLASS}>
                <div className="w-5 h-5 relative mr-3 flex-shrink-0">
                  <CategoryIcon name={c.icon} className={`w-5 h-5 ${c.tailwind}`} />
                </div>
                <span className={LABEL_CLASS}>{c.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
