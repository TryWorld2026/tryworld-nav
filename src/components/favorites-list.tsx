'use client';

import { Bookmark, BookmarkCheck, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  favoritesChangedEvent,
  readStore,
  writeStore,
  STORAGE_KEY,
  toggleFavorite,
  type FavoriteItem,
  type FavoriteStore,
} from '@/lib/favorites';
import { formatDate } from '@/lib/news';
import { rgb } from '@/lib/utils';

/**
 * `/favorites` 的列表本体。
 *
 * 这个页面存在的原因：详情页一直有「添加收藏」，写进 localStorage 后刷新都还在
 * （功能是真的），但**全站没有任何收藏夹入口** —— 用户存了却再也看不到，
 * 等于写进一个黑洞（见 work/analysis-ia.md §9⑤）。
 *
 * 同时它替换掉了页眉右上那个「登录/注册」：那个按钮点开写着「复刻版本未包含
 * 账号系统，登录与注册暂不可用」，是首屏视觉权重第二高的元素，直接打击信任。
 * 静态站确实没有账号体系，但「收藏 + 本机可见」是能诚实地做出来的东西。
 *
 * 渲染策略：先渲染骨架，挂载后再读 localStorage（服务端预渲染时没有 storage，
 * 直接读会让 HTML 与首次渲染不一致，触发 hydration 报错）。
 */
export function FavoritesList() {
  const [store, setStore] = useState<FavoriteStore>({ version: 2, items: [] });
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => {
    setStore(readStore());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    // 同一个 tab 里别的组件改了收藏（详情页的按钮），这里要跟着变。
    window.addEventListener(favoritesChangedEvent, refresh);
    // 另一个标签页改了收藏，浏览器会派发 storage 事件。
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(favoritesChangedEvent, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return store.items;
    return store.items.filter(
      (it) => it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q),
    );
  }, [store.items, query]);

  const remove = useCallback((item: FavoriteItem) => {
    // toggleFavorite 对「已存在」的条目就是移除，正好是这里要的语义。
    // 走 writeStore 而不是直接写 storage：它负责广播，列表与详情页按钮同步。
    const next = toggleFavorite(readStore(), item);
    writeStore(next.store);
  }, []);

  if (!ready) {
    // 骨架：避免「先闪一下空态再出现列表」。
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-foreground/10 bg-card" />
        ))}
      </div>
    );
  }

  if (store.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 px-6 py-16 text-center">
        <Bookmark className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground/70">还没有收藏任何工具</p>
        <p className="mt-1 text-xs text-muted-foreground">
          在工具详情页点「添加收藏」，收藏会保存在这台设备上，不需要登录。
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/tools"
            className="inline-flex h-10 items-center rounded-md bg-gongke-accent px-4 text-sm font-medium text-white transition-colors hover:bg-gongke-accent/90"
          >
            去逛逛全部工具
          </Link>
          <Link
            href="/categories"
            className="inline-flex h-10 items-center rounded-md border border-foreground/15 px-4 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/25"
          >
            按场景浏览
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          共 <span className="font-medium text-foreground">{store.items.length}</span> 个收藏
        </p>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="在收藏里搜索…"
            aria-label="在收藏里搜索"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          收藏里没有匹配「{query}」的工具。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((it) => {
            // 时间必须走 `Asia/Shanghai` 的格式化函数。原先写的是
            // `it.addedAt.slice(0, 10)` —— 那是 UTC 日期，北京时间 0:00–8:00
            // 之间收藏的工具会显示成「昨天」，而页面上完全看不出来。
            const addedOn = it.addedAt ? formatDate(it.addedAt) : '';
            return (
            <li
              key={it.slug}
              className="group flex items-start gap-3 rounded-xl border border-foreground/10 bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03]">
                {it.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.icon}
                    alt=""
                    width={44}
                    height={44}
                    loading="lazy"
                    className="h-11 w-11 object-contain"
                  />
                ) : (
                  <Bookmark className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tools/${it.slug}`}
                  className="line-clamp-1 text-[15px] font-semibold text-foreground hover:text-gongke-accent"
                >
                  {it.name}
                </Link>
                {it.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-gongke-muted">
                    {it.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  {it.category && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-1.5 py-0.5 text-[12px] text-foreground/70">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: rgb(it.category.color) }}
                      />
                      {it.category.name}
                    </span>
                  )}
                  {addedOn && (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      收藏于 {addedOn}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(it)}
                aria-label={`取消收藏 ${it.name}`}
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-center gap-1.5 pt-2 text-[12px] text-muted-foreground">
        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
        收藏只保存在这台设备的浏览器里，不上传、不需要账号。换设备或清除浏览器数据会丢失。
      </p>
    </div>
  );
}
