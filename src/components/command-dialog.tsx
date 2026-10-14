'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, X } from 'lucide-react';
import { CategoryIcon } from './category-icon';
import { categories, featured, hotCategories, searchTools, tools } from '@/lib/data';
import { rgb, rgbAlpha } from '@/lib/utils';

export function CommandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Hand focus back to whatever opened the palette. Without this, closing it
  // drops the user at the top of the document — a keyboard user then has to tab
  // through the whole page to get back to where they were.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    return () => {
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open]);

  const panelRef = useRef<HTMLDivElement>(null);

  // aria-modal promises the page behind is inert, so Tab has to stay inside.
  const onPanelKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, []);

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      if (/^https?:\/\//.test(href)) window.location.assign(href);
      else router.push(href);
    },
    [onOpenChange, router],
  );

  const toolResults = useMemo(() => searchTools(query, 30), [query]);
  const catResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hotCategories.slice(0, 8);
    return categories
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
      .slice(0, 6);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="搜索AI工具"
        onKeyDown={onPanelKeyDown}
        className="fixed left-1/2 top-[12vh] w-[92vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-fade-in"
      >
        <Command shouldFilter={false} loop className="w-full">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="搜索 AI 工具、分类…"
              className="h-12 w-full rounded bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              onClick={() => onOpenChange(false)}
              aria-label="关闭"
              className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
            {query.trim() !== '' && toolResults.length === 0 && catResults.length === 0 && (
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                未找到 “{query}” 相关的工具
              </Command.Empty>
            )}

            {catResults.length > 0 && (
              <Command.Group
                heading={query.trim() ? '分类' : '热门分类'}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {catResults.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`cat-${c.slug}`}
                    onSelect={() => go(`/categories/${c.slug}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-accent/10"
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md"
                      style={{ background: rgbAlpha(c.color, 0.12), color: rgb(c.color) }}
                    >
                      <CategoryIcon name={c.icon} className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {tools.filter((t) => t.categories.some((x) => x.id === c.id)).length} 个工具
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {query.trim() === '' && (
              <Command.Group
                heading="常用推荐"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {featured.slice(0, 6).map((t) => (
                  <Command.Item
                    key={t.name}
                    value={`feat-${t.slug}`}
                    onSelect={() => go(t.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-accent/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.icon}
                      alt={t.name}
                      className="h-7 w-7 rounded-md border border-border object-contain p-0.5"
                    />
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="max-w-[50%] truncate text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {toolResults.length > 0 && (
              <Command.Group
                heading={`工具 · ${toolResults.length}`}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {toolResults.map((t) => (
                  <Command.Item
                    key={t.id}
                    value={t.slug}
                    onSelect={() => go(`/tools/${t.slug}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-accent/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.icon}
                      alt={t.name}
                      className="h-7 w-7 rounded-md border border-border object-contain p-0.5"
                    />
                    <span className="flex-1 truncate font-medium">{t.name}</span>
                    <span className="max-w-[55%] truncate text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ 选择 · ↵ 打开 · Esc 关闭</span>
            <span>共 {tools.length} 个工具</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
