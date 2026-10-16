'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { CategoryIcon } from './category-icon';
import { featured, hotCategories, SITE } from '@/lib/data';
import { rgb, rgbAlpha } from '@/lib/utils';

const LINKS = [
  { href: '/tools', label: '查看全部' },
  { href: '/categories', label: '所有分类' },
  { href: '/about', label: '关于我们' },
];

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 top-14 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 top-14 z-40 max-h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-thin border-b border-border bg-background px-4 py-5 shadow-lg lg:hidden">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <span className="text-base font-bold font-display text-foreground">{SITE.name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭菜单"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-foreground/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mb-6 grid grid-cols-3 gap-2">
          {LINKS.map((l) => (
            <Link
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
            <Link
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
            <Link
              key={c.id}
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
