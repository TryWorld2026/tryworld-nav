'use client';

import { useEffect } from 'react';
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

  // Any navigation dismisses the drawer, so a stale panel never covers the
  // page the user just asked for.
  useEffect(() => onClose(), [pathname, onClose]);

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
