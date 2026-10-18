'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Flame, LayoutList, Newspaper, Orbit, Sparkles } from 'lucide-react';
import { SECTION_WIDTH_CLASS, type SectionWidth } from '@/lib/layout';

/**
 * 资讯频道的分段控件：资讯流 / 日报 / 周报 / 月报 / 热点。
 *
 * 这是本轮用户反馈「界面上看不到新闻资讯的按钮」的正面答案：不只是加一个入口，
 * 而是把资讯做成一个**有分区的栏目**。五个分区对应 AIHOT 的四种内容形态 ——
 * 实时的资讯卡片流、每日出刊的日报、每周回顾、每月回顾、当前热点榜。
 *
 * 形态：横向可滚动的 pill 栏，`sticky` 吸附在顶栏下方（顶栏高 56px，见
 * `header.tsx` 的 `h-14`），所以往下滚读日报时还能随时切分区。手机上左右边缘
 * 各有一层渐变遮罩，提示「还能滑」；桌面端五个 pill 放得下，遮罩自然消失
 * （`lg:hidden`）。
 *
 * 当前项用品牌绿实心，其余是描边幽灵 —— 与站内主次按钮的层级一致。切换的
 * 过渡用 `transition-all duration-200`，不引入任何动画库。
 */

const TABS = [
  { href: '/news', label: '资讯流', icon: LayoutList, key: 'feed' },
  { href: '/news/daily', label: 'AI 日报', icon: Newspaper, key: 'daily' },
  { href: '/news/weekly', label: '周报', icon: Orbit, key: 'weekly' },
  { href: '/news/monthly', label: '月报', icon: Sparkles, key: 'monthly' },
  { href: '/news/hot', label: '热点', icon: Flame, key: 'hot' },
] as const;

export type NewsTabKey = (typeof TABS)[number]['key'];

/**
 * 频道栏必须与**所在页面正文**同宽，否则左缘会错开。
 *
 * 宽度按版块分两类：
 *
 *   - **索引页**（资讯流 / 日报总览 / 热点榜）：`content` 1760，与站内其他
 *     目录页一致。2560 下 1088 的正文两侧各空 640px，三张卡片的列表被挤在
 *     屏幕中间那一条 —— 这是「宽屏塌陷」最典型的一处；
 *   - **正文页**（日报 / 周报 / 月报的单期）：`rail` 1376 或 `period` 860，
 *     阅读宽度按内容形态收窄，条目不会被拉成一行 100+ 字符。
 *
 * 用一把尺子量到底是不可能的 —— 2560 实测，`reading` 的频道栏在日报正文页
 * 比正文右移 144px，在周报页右移 113px，在归档页右移 328px，三个页面看起来
 * 像「导航浮在另一套排版上」。所以由调用方按正文宽度传进来。
 *
 * 默认 `reading` 是历史值（周报 / 月报索引仍用它），新页面请显式传 `content`。
 */
export type NewsTabsWidth = SectionWidth;

export function NewsTabs({
  active,
  width = 'reading',
}: {
  active: NewsTabKey;
  width?: NewsTabsWidth;
}) {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // 手机上横向滚到两端时收起对应的渐变遮罩。`resize` 也要听，因为旋转屏幕
  // 会改变可视宽度。
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setEdges({
        left: el.scrollLeft > 8,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // 切到新分区后，把当前 pill 滚进可视区（手机上一排 pill 放不下五个）。
  useEffect(() => {
    const el = scrollerRef.current;
    const current = el?.querySelector<HTMLElement>('[data-active="true"]');
    if (!el || !current) return;
    const left = current.offsetLeft - el.clientWidth / 2 + current.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [pathname]);

  return (
    <div
      // `data-news-tabs` 是给布局回归脚本用的锚点：频道栏的可见左缘在**内层**
      // 容器上（外层是满宽的 sticky 条，左缘永远是 0），探测必须先定位到这个
      // 属性再往下量。没有它时脚本只能去抓 `nav[aria-label]`，而全站第一个
      // 匹配项是固定左栏，量出来永远是 delta=-496 的假错位。
      data-news-tabs={width}
      className="sticky z-30 mb-6 border-b border-foreground/5 bg-background/90 backdrop-blur-xl"
      // 顶栏高度由 `header.tsx` 量出来写进 CSS 变量（收起时为 0），所以频道栏
      // 永远贴在顶栏下沿，不会因为断点差异出现一条缝。
      style={{ top: 'var(--site-header-h, 3.5rem)' }}
    >
      {/* 这里**不能**用 `-mx-4` 去贴边：负外边距会让元素比父容器宽出 8px，
          而父容器没有 `overflow` 裁剪，手机上整页被推出视口（390px 视口实测
          撑到 406px）。改成外层满宽、内层自己带内边距，视觉上一样贴边。 */}
      {/* 与正文用**同一个**容器 —— 具体用哪把尺子由调用方的 `width` 决定，
          原因见上面 `NewsTabsWidth` 的注释。手机上三种容器都是满宽（都吃满
          视口），无差异；错位只发生在 ≥1024。 */}
      <div className={`${SECTION_WIDTH_CLASS[width]} relative`}>
        <div
          ref={scrollerRef}
          className="scrollbar-none flex items-center gap-1.5 overflow-x-auto py-2.5"
        >
          {TABS.map((t) => {
            const on = t.key === active;
            const Icon = t.icon;
            return (
              <Link
                key={t.key}
                href={t.href}
                data-active={on ? 'true' : 'false'}
                aria-current={on ? 'page' : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 sm:min-h-0 sm:px-3.5 ${
                  on
                    ? 'bg-gongke-accent text-white shadow-sm shadow-gongke-accent/20'
                    : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground/85'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${on ? 'scale-110' : ''}`}
                  aria-hidden="true"
                />
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* 手机端的两端渐变，提示可横滑。`pointer-events-none` 保证不挡点击。 */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent transition-opacity duration-200 lg:hidden ${
            edges.left ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-200 lg:hidden ${
            edges.right ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </div>
  );
}

/**
 * 上一期 / 下一期 的翻页条，日报、周报、月报共用。
 *
 * 传 `null` 的一侧渲染成不可点的灰字而不是消失 —— 消失会让卡片宽度跳变，
 * 连翻几期时页面左右晃。
 */
export function PeriodPager({
  prev,
  next,
  label,
}: {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
  label?: string;
}) {
  return (
    <nav
      aria-label={label ?? '翻页'}
      className="mt-10 flex items-stretch gap-3 border-t border-foreground/5 pt-6"
    >
      <PagerSide href={prev?.href} text={prev?.label} dir="prev" />
      <PagerSide href={next?.href} text={next?.label} dir="next" />
    </nav>
  );
}

function PagerSide({
  href,
  text,
  dir,
}: {
  href?: string;
  text?: string;
  dir: 'prev' | 'next';
}) {
  const Icon = dir === 'prev' ? ArrowLeft : ArrowRight;
  const body = (
    <>
      {dir === 'prev' && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
          {dir === 'prev' ? '上一期' : '下一期'}
        </span>
        <span className="block truncate text-sm font-medium">{text ?? '—'}</span>
      </span>
      {dir === 'next' && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </>
  );

  // `min-w-0` 必须在这一层：两个翻页块是同一个 flex 行的两个子项，默认
  // `min-width:auto` 时，任一侧的长标题会把整行撑到内容宽度（实测手机
  // 390px 视口下 2026-10-17 那期被撑到 662px，页面横向可拖）。
  const base =
    'flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3.5 py-3 transition-all duration-200';

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={`${base} border-foreground/5 text-muted-foreground ${dir === 'next' ? 'text-right' : ''}`}
      >
        {body}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} border-foreground/10 bg-card hover:-translate-y-0.5 hover:border-gongke-accent/30 hover:shadow-md active:translate-y-0 active:scale-[0.99] ${
        dir === 'next' ? 'text-right' : ''
      }`}
    >
      {body}
    </Link>
  );
}
