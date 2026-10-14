'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { ToolMiniCard } from './tool-card';
import { CategoryIcon } from './category-icon';
import { Button } from './ui/button';
import { rgb, rgbAlpha } from '@/lib/utils';
import type { Category, Tag, Tool } from '@/lib/types';

const PAGE = 60;

/**
 * The initial filter state, read from the URL on the client.
 *
 * This page is statically exported, so it cannot read `searchParams` on the
 * server — and the origin's own /tools is a client component too (its SSR body
 * is a skeleton). Reading `location.search` after mount keeps `/tools?q=foo`
 * and `/tools?cat=ai-writing` working without making the route dynamic.
 */
function useUrlFilter(): { q: string; cat: string } {
  const [state, setState] = useState({ q: '', cat: '' });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setState({ q: params.get('q') ?? '', cat: params.get('cat') ?? '' });
  }, []);
  return state;
}

export function ToolsExplorer({
  tools,
  categories,
  tags,
}: {
  tools: Tool[];
  categories: Category[];
  tags: Tag[];
}) {
  const url = useUrlFilter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState('');
  const [limit, setLimit] = useState(PAGE);

  // Apply the URL filter once, on the first render after the effect lands.
  useEffect(() => {
    if (url.q) setQuery(url.q);
    if (url.cat) setActive(url.cat.split(',').filter(Boolean));
  }, [url.q, url.cat]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    let list = tools;
    if (active.length > 0) {
      const set = new Set(active);
      list = list.filter((t) => t.categories.some((c) => set.has(c.slug)));
    }
    if (activeTag) {
      list = list.filter((t) => t.tags.includes(activeTag));
    }
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.categories.some((c) => c.name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [tools, active, activeTag, q]);

  const visible = results.slice(0, limit);

  function toggleCategory(slug: string) {
    setLimit(PAGE);
    setActive((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function reset() {
    setQuery('');
    setActive([]);
    setActiveTag('');
    setLimit(PAGE);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="搜索工具名称、简介或分类…"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="清空搜索"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-foreground/5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">标签</span>
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTag((p) => (p === t.name ? '' : t.name));
                  setLimit(PAGE);
                }}
                aria-pressed={activeTag === t.name}
                className={
                  activeTag === t.name
                    ? 'inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent'
                    : 'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">分类</span>
          {categories.map((c) => {
            const on = active.includes(c.slug);
            return (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.slug)}
                aria-pressed={on}
                className={
                  on
                    ? // A transparent border keeps the chip the same height as the
                      // unselected ones, so the row doesn't jump when toggling.
                      'inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium'
                    : 'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
                }
                style={
                  on
                    ? { background: rgbAlpha(c.color, 0.14), color: rgb(c.color) }
                    : undefined
                }
              >
                <CategoryIcon name={c.icon} className="h-3 w-3" />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          共 <span className="font-medium text-foreground">{results.length}</span> 个工具
        </p>
        {(active.length > 0 || activeTag || query) && (
          <Button variant="ghost" size="sm" onClick={reset}>
            重置筛选
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          没有匹配的工具，试试其他关键词。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 4xl:grid-cols-7 5xl:grid-cols-8">
            {visible.map((t) => (
              <ToolMiniCard key={t.id} tool={t} />
            ))}
          </div>
          {limit < results.length && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setLimit((l) => l + PAGE * 2)}
                className="border-border text-foreground/80"
              >
                加载更多（还有 {results.length - limit} 个）
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
