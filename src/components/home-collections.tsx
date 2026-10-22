import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { collections } from '@/lib/data';

/**
 * 首页的「编辑精选集合」条。
 *
 * 为什么需要：9 个 `/collections` 页面原先**全站 0 内链** —— 首页、/tools、
 * 26 个分类页、2081 个工具页、页眉、侧栏、页脚都没有指向它们的链接，
 * 只有 sitemap.xml 里能到（work/analysis-ia.md §9④）。而它们恰好是最接近
 * 「第一次来、不知道用哪个」这种需求的内容：按人群（独立开发者/大厂）、
 * 按预算（完全免费）、按口碑（编辑推荐）挑工具。
 *
 * 位置：放在「最新添加」之后、「AI 资讯」之前。顺序是「热门 → 上新 → 精挑
 * → 资讯 → 按分类逛」：用户先看到量大，再看到少而精的选择。
 *
 * 形态：一行横向滚动的紧凑卡片（不是网格）——9 个集合用网格会在宽屏留 3 个
 * 空位，而这一条只是「路标」，不该抢热门工具的位置。
 */
export function HomeCollections() {
  if (collections.length === 0) return null;

  return (
    <section className="bg-background pt-12" aria-labelledby="home-collections-heading">
      <div className="content-container">
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="home-collections-heading"
            className="flex shrink-0 items-center gap-2.5 text-[19px] font-semibold text-foreground"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gongke-accent/[0.07] text-gongke-accent ring-1 ring-inset ring-gongke-accent/10"
              aria-hidden="true"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            编辑精选
            <span className="ml-1 rounded-full bg-gongke-accent/10 px-2 py-0.5 text-[11px] font-medium text-gongke-accent">
              {collections.length} 个清单
            </span>
          </h2>
          <span className="h-px min-w-4 flex-1 bg-foreground/10" aria-hidden="true" />
          <Link prefetch={false}
            href="/collections"
            className="group hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-gongke-accent md:inline-flex"
          >
            全部清单
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* 取 6 个而不是 5 个：768–1279 是 3 列，5 张会排成 3+2，
            第二行右侧空出一整个卡位（1920 的 5 列反而正好）。渲染第 6 张、
            只在 `xl` 隐藏，于是三档都排满：手机横滑 6 张、平板与 1024 笔电
            3+3、1280 以上 5 列 5 张。 */}
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-5">
          {collections.slice(0, 6).map((c, i) => (
            <Link prefetch={false}
              key={c.slug}
              href={`/collections/${c.slug}`}
              className={`group flex w-[240px] shrink-0 flex-col rounded-xl border border-foreground/10 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md md:w-auto${
                i === 5 ? ' xl:hidden' : ''
              }`}
            >
              <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground transition-colors group-hover:text-gongke-accent">
                {c.name}
              </span>
              <span className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-gongke-muted">
                {c.description}
              </span>
              <span className="mt-3 flex items-center gap-1.5 text-[11.5px] tabular-nums text-muted-foreground">
                {c.memberIcons.slice(0, 4).map((icon) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={icon}
                    src={icon}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    className="h-4 w-4 rounded-[3px] object-contain"
                  />
                ))}
                <span className="ml-1">{c.tools.length} 个工具</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
