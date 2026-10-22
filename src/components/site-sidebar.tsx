import Link from 'next/link';
import { Bookmark, ChevronRight, Layers2, Newspaper, Scale, Sparkles } from 'lucide-react';
import { CategoryIcon } from './category-icon';
import { SiteLogo } from './site-logo';
import { navFeatured as featured, navHotCategories as hotCategories } from '@/lib/nav';
import { SITE } from '@/lib/site';
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
 *
 * 2026-10-17：原站还给 `ai-ppt` / `ai-content-detection` / `ai-recruiting-tools`
 * 各指定了一个紫系色（violet-500 / purple-500 / violet-600）。试界品牌无紫，
 * 那三条覆盖已整体删除，这三行改回由 `categories.json` 驱动 —— 数据侧现在给出
 * teal-700 / red-700 / green-700。
 *
 * 同一天，剩下 5 条**纯色**覆盖（ai-agents rose-500 / ai-coding slate-500 /
 * ai-browser yellow-500 / ai-mindmap-whiteboard blue-500 / ai-prompt-tools
 * emerald-500 / ai-lawer-tools yellow-500）也一并删除，理由同样是「对不上」：
 * 侧栏的「AI浏览器」是黄的、分类页却是青的，「AI法律助手」在侧栏与分类页之间
 * 还差一档（yellow-500 vs yellow-400）。更要命的是这 5 条覆盖里有 3 条撞色
 * （yellow-500 出现 3 次、blue-500 与 emerald-500 各 2 次），而 `categories.json`
 * 现在是 26 个互不重复的色相。删完之后 18 行侧栏色相全唯一，且每一行都和它
 * 对应的分类页、工具卡圆点同色。
 *
 * 覆盖表因此只剩**标签**：原站确实另起了名字，且这不影响任何颜色一致性。
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

/** Rows where the origin's hardcoded label beats the payload's. */
const SIDEBAR_PRESENTATION: Record<string, { name?: string; tailwind?: string }> = {
  'ai-writing': { name: 'AI文章写作' },
  'ai-coding': { name: 'AI编程代码' },
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

/**
 * 「AI 资讯」是侧栏里唯一的顶级入口，也是本轮**有意偏离原站**的一处。
 *
 * 原站的侧栏只有两组：常用推荐（外链产品）+ 热门分类（站内分类页）。本站自己
 * 做了 AIHOT 聚合栏目，它既不是「一个工具」也不是「一个分类」，塞进任何一组
 * 都会语义错位，所以在两组之上单独给它一个顶级块。
 *
 * 视觉上用品牌绿底白字而不是复用 `NAV_CLASS` 的幽灵行：这是站内唯一一个
 * 「内容栏目」入口（其余全是导航/索引），值得被看见，也是用户反馈「界面上
 * 看不到新闻资讯的按钮」最直接的回应。`mb-8` 与下面两组的间距对齐。
 */
const NEWS_BLOCK_CLASS =
  'group mb-8 flex items-center rounded-lg bg-gongke-accent px-3 py-2.5 text-white shadow-sm transition-all duration-200 hover:bg-gongke-accent/90 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gongke-accent focus-visible:ring-offset-2';

export function SiteSidebar() {
  const rows = SIDEBAR_SLUGS.map((slug) => {
    const c = hotCategories.find((x) => x.slug === slug);
    if (!c) return null;
    const override = SIDEBAR_PRESENTATION[slug];
    return {
      slug,
      name: override?.name ?? c.name,
      icon: c.icon,
      // Every row now takes its tone from the payload — see the note above on
      // why the origin's five colour overrides were removed. The `text-` prefix
      // is in the data already, so it is used verbatim.
      tailwind: override?.tailwind ?? c.tailwind,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <aside
      className={cn(
        'scrollbar-none hover:scrollbar-thin scrollbar-track-transparent',
        'w-48 border-r border-foreground/[0.07] h-screen p-4 bg-card',
        'hidden lg:block fixed left-0 top-0 bottom-0 overflow-y-auto',
      )}
    >
      {/* The origin pins the brand over the scroll area so the two nav groups
          slide under it. Its width is `calc(14rem-56px)` while the panel is
          `w-48` (12rem) — the calc is a leftover from a wider panel and is kept
          as-is rather than corrected. */}
      <div className="fixed top-0 left-0 w-[calc(14rem-56px)] bg-card p-4 z-10">
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
        {/* 见 NEWS_BLOCK_CLASS 处的说明：对原站复刻的有意偏离。 */}
        <Link href="/news" className={NEWS_BLOCK_CLASS} data-testid="news-sidebar-link">
          <Newspaper
            className="mr-2.5 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-rotate-6"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">AI 资讯</span>
          <ChevronRight
            className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-90"
            aria-hidden="true"
          />
        </Link>

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
            常用分类
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
            {/* 侧栏原先只列 18 个分类（写死的 SIDEBAR_SLUGS），其余 8 类
                （网站制作、记录摘要、文档办公、学习教育、营销推广、翻译、
                金融投资、客服系统）在桌面端只能从页眉下拉进。补一个出口，
                并把标题从「热门分类」改成「常用分类」—— 它是写死的清单，
                不是按热度算的，原来的名字在说谎。 */}
            <Link
              href="/categories"
              className={`${NAV_CLASS} text-gongke-accent`}
              data-testid="sidebar-all-categories"
            >
              <div className="w-5 h-5 relative mr-3 flex-shrink-0 flex items-center justify-center">
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="text-sm font-medium">全部 26 个分类</span>
            </Link>
          </nav>
        </div>

        <div className="mb-8">
          <h2 className={HEADING_CLASS}>
            <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
            编辑精选
          </h2>
          <nav className="space-y-1">
            {/* 9 个编辑集合原先全站 0 内链（只在 sitemap 里），是最接近
                「第一次来不知道选哪个」的内容，却没有任何入口。 */}
            <Link href="/collections" className={NAV_CLASS} data-testid="sidebar-collections">
              <div className="w-5 h-5 relative mr-3 flex-shrink-0 flex items-center justify-center">
                <Layers2 className="w-4 h-4 text-gongke-accent" aria-hidden="true" />
              </div>
              <span className={LABEL_CLASS}>9 个工具清单</span>
            </Link>
            {/* 二选一对比：站内唯一直接回答「这两个该选哪个」的入口。
                详情页的「怎么选」回答的是「这一个适合我吗」，读者真正卡住的
                是「在两者之间选」—— 没有入口的话那 298 个页面只能从 sitemap
                到达，等于没做。 */}
            <Link href="/compare" className={NAV_CLASS} data-testid="sidebar-compare">
              <div className="w-5 h-5 relative mr-3 flex-shrink-0 flex items-center justify-center">
                <Scale className="w-4 h-4 text-gongke-accent" aria-hidden="true" />
              </div>
              <span className={LABEL_CLASS}>二选一对比</span>
            </Link>
            <Link href="/favorites" className={NAV_CLASS}>
              <div className="w-5 h-5 relative mr-3 flex-shrink-0 flex items-center justify-center">
                <Bookmark className="w-4 h-4 text-gongke-accent" aria-hidden="true" />
              </div>
              <span className={LABEL_CLASS}>我的收藏</span>
            </Link>
          </nav>
        </div>
      </div>
    </aside>
  );
}
