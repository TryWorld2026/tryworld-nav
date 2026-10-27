'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Compass, X } from 'lucide-react';
import { CategoryIcon } from './category-icon';
import { navFeatured as featured, navHotCategories as hotCategories } from '@/lib/nav';
import { SITE } from '@/lib/site';
import { rgb, rgbAlpha } from '@/lib/utils';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';

const LINKS = [
  { href: '/tools', label: '查看全部' },
  { href: '/categories', label: '所有分类' },
  { href: '/news', label: 'AI 资讯' },
  { href: '/about', label: '关于我们' },
];

/**
 * 原站的这个网格是 `grid-cols-3` 三项。加「AI 资讯」变成四项后改成了四列 ——
 * 三列会让第四项自己换行占满一行，四个按钮变成 3+1 的跛脚布局。
 * `grid-cols-2`（两行两列）在 320px 宽的屏幕上按钮太矮，点击区不够 APP 感，
 * 所以选四列单行：每个按钮约 70px 宽，仍然是舒适的点按尺寸。
 */
const LINKS_GRID_CLASS = 'mb-6 grid grid-cols-4 gap-2';

/**
 * The drawer the header's `lg:hidden` menu button opens.
 *
 * The origin's own mobile panel is not in any captured document — the trigger
 * is, and nothing else is — so this carries the same 常用推荐 / 热门分类
 * navigation as the desktop sidebar, which is the only reading of it that
 * keeps the catalog reachable on a phone. It is a controlled component: the
 * header owns the trigger, because the trigger is the origin's.
 */
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  /**
   * 导航离开时关闭抽屉，避免旧面板盖住用户刚请求的页面。
   *
   * ⚠️ 这里**必须**记住上一次的 pathname，只在它**变化**时关闭。
   *
   * 原先写的是 `useEffect(() => onClose(), [pathname, onClose])` —— 少了"变化"
   * 这个条件。React 的 effect 在**首次挂载后也会执行一次**，于是菜单刚被打开
   * （`open` 变 true 触发挂载）就立刻被这次 effect 关掉，表现为**移动端点汉堡
   * 菜单毫无反应**：DOM 里面板只存在一帧。2026-10-16 用 MutationObserver 抓到
   * 了这一点（`appeared: true` 但 `count: 1`，之后 `close_btn` 归 0）。
   *
   * 桌面端不受影响，因为"所有分类"面板是 header 内联渲染的，不走这个组件 ——
   * 所以只看桌面测试会漏掉这个 bug，移动端必须单独回归。
   *
   * 另外 `onClose` 每次渲染都是新函数（header 里传的是内联箭头函数），若把它
   * 放进依赖数组，任何一次父组件重渲染都会触发这个 effect。所以这里用 ref 拿
   * 最新的 onClose，依赖只留 pathname。
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      onCloseRef.current();
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /**
   * 抽屉打开时锁住页面滚动。
   *
   * 改用共享的 `useBodyScrollLock`：原先这里是内联的一份
   * `body.style.overflow` 存/还原，而搜索面板用的是带计数的那份 ——
   * 两份实现各存各的 `prev`，先关的那个会把后关的锁解开（页面在弹层底下
   * 滚动）。共享实现用计数器，不会互相踩。
   */
  useBodyScrollLock(open);

  /**
   * 焦点管理：打开时把焦点移进抽屉，关闭时还给触发它的按钮。
   *
   * 为什么必须做：抽屉声明了 `aria-modal="true"`，等于向辅助技术承诺
   * 「背景不可交互」。但抽屉里全是链接，**没有一个可聚焦元素**——不手动
   * 移进去，键盘用户的焦点还留在背后的页面上，Tab 会一路 Tab 到页面底
   * 部而不是在抽屉里循环。读屏用户则完全不知道抽屉开了。
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // 等一帧，确保抽屉已经挂载、里面的链接可聚焦。
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open]);

  /**
   * Tab 陷阱：焦点在抽屉末尾时按 Tab 回到开头，Shift+Tab 在开头时跳到末尾。
   *
   * 和搜索面板用的是同一套逻辑（见 `command-dialog.tsx` 的 `onPanelKeyDown`）。
   * 抽屉里有几十个链接，没有陷阱的话 Tab 会走出抽屉、跑到被遮住的背景上，
   * 用户按十几下 Esc 都不知道自己在哪。
   */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!e.shiftKey && (active === last || !panel.contains(active))) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 animate-[sheet-fade_0.2s_ease-out] lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      {/* 底部抽屉：从屏幕下沿滑上来，圆角、抓手条、安全区内边距 —— 这是
          手机上最像原生 APP 的导航形态（顶部下拉是另一套，底部上滑更顺手）。
          `max-h-[85dvh]` 用动态视口单位，避免 iOS 地址栏伸缩时抽屉被截断。 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="站内导航"
        onKeyDown={onPanelKeyDown}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] animate-[sheet-up_0.28s_cubic-bezier(0.22,1,0.36,1)] overflow-y-auto scrollbar-thin rounded-t-2xl border-t border-border bg-background px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl lg:hidden"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-foreground/15" aria-hidden />
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <span className="text-base font-bold font-display text-foreground">{SITE.name}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="关闭菜单"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-foreground/5"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 决策入口：抽屉里唯一的高对比块。
            手机上没有左侧栏、页眉导航也是隐藏的，`/decide` 若只藏在「查看全部」
            的次级页面里等于没有入口 —— 而它正是这站最该被用起来的能力。 */}
        <Link
          prefetch={false}
          href="/decide"
          onClick={onClose}
          data-testid="decide-drawer-link"
          className="mb-3 flex items-center gap-3 rounded-xl bg-gongke-dark px-4 py-3 text-white shadow-sm transition-colors hover:bg-gongke-dark/90"
        >
          <Compass className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">帮我选</span>
            <span className="mt-0.5 block text-xs leading-snug text-white/70">
              三个问题，从 363 条人工判断里缩到 3 个
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
        </Link>

        <nav className={LINKS_GRID_CLASS}>
          {LINKS.map((l) => (
            <Link prefetch={false}
              key={l.href}
              href={l.href}
              className="rounded-md border border-border px-3 py-2 text-center text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <h2 className="mb-3 px-1 text-sm font-semibold text-foreground">常用推荐</h2>
        <nav className="mb-7 space-y-1">
          {featured.map((t) => (
            <Link prefetch={false}
              key={t.name}
              href={t.href}
              className="flex items-center rounded-md px-2 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.icon}
                alt={t.name}
                width={20}
                height={20}
                className="mr-3 h-5 w-5 shrink-0 rounded object-contain"
              />
              <span className="truncate">{t.name}</span>
            </Link>
          ))}
        </nav>

        <h2 className="mb-3 px-1 text-sm font-semibold text-foreground">热门分类</h2>
        <nav className="grid grid-cols-2 gap-1">
          {hotCategories.map((c) => (
            <Link prefetch={false}
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="flex items-center rounded-md px-2 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
            >
              <span
                className="mr-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded"
                style={{ background: rgbAlpha(c.color, 0.12), color: rgb(c.color) }}
              >
                <CategoryIcon name={c.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{c.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
