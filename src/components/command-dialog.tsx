'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { ArrowRight, Search, X } from 'lucide-react';
import { CategoryIcon } from './category-icon';
// 索引只在 `lib/catalog-index.ts` 里解码一次：面板与 `/tools` 筛选共用同一份
// `SearchRecord[]`，别再自己 `as SearchRecord[]` 强转 v2 wire（那是裸数组时代的写法）。
import { CATALOG_BY_SLUG, CATALOG_INDEX } from '@/lib/catalog-index';
import { navCategories, navFeatured, navHotCategories } from '@/lib/nav';
import { searchIndex } from '@/lib/search';
import { searchReason } from '@/lib/search-reason';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';
import { rgb, rgbAlpha } from '@/lib/utils';
import { asset } from '@/lib/assets';

/**
 * 全站唯一的搜索面板（页眉按钮、⌘K / Ctrl+K、`/`、移动端底部中央圆钮共用）。
 *
 * 2026-10-18 重做，三处行为变了：
 *
 *   1. **数据源换成 `data/search-index.json` + `lib/nav.ts`**。原先它直接
 *      `import { categories, featured, searchTools, tools } from '@/lib/data'`，
 *      而 `header.tsx` 是客户端组件 —— 于是 2081 条工具、26 个分类（内嵌工具
 *      列表）、资讯、合集全部被打进 layout chunk，**每个页面白付 182 KB（br）**。
 *      现在面板只要索引（59 KB br）与 5 KB 导航数据。
 *
 *   2. **结果顺序改了**：查询非空时「工具」组排第一，分类排第二。原先分类在
 *      前，用户输「视频」按回车会落到 `/categories/ai-video-animation` ——
 *      想找一个工具，却先到分类页，还要再点一次。
 *
 *   3. **给 30 条上限一个出口**：底部原先只有一行死的「共 2081 个工具」。
 *      现在换成「在全部工具中搜索 “X” →」，把关键词带进 `/tools?q=`，
 *      那里没有条数上限、可继续用分类/标签收窄。
 *
 * 键盘工程保持不变（这些在 2026-10-17 已经做对，别改坏）：自动聚焦、
 * `Esc` 关闭、焦点归还触发元素、`aria-modal` + Tab 陷阱、`↑↓` 循环。
 * 新增：打开时锁住背景滚动（原先 `aria-modal=true` 但背景照样能滚）。
 */
export function CommandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  /*
   * 2026-10-23（task-2 第 4 条）复核：背景滚动锁**已经**接在这里了，走的是
   * `lib/use-body-scroll-lock.ts` 的共用实现 —— 它用 `overflow: hidden` 而不是
   * `position: fixed`（后者在 iOS 上会让页面跳回顶部）；用引用计数而不是布尔，
   * 因为搜索面板可以叠在移动抽屉上打开，先关的那个不能把后关的锁解开；
   * 关掉时把 `body.style.overflow` 还原成打开前的原值。这里不重复实现。
   */
  useBodyScrollLock(open);

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

  const trimmed = query.trim();
  const toolResults = useMemo(() => searchIndex(CATALOG_INDEX, query, 30), [query]);

  /**
   * 命中依据的「解释力」：同一句话在结果里出现太多次就说明它不区分工具。
   *
   * 实测（2026-10-23）：搜「小红书」时前 5 条全是「因为命中关键词」——读者
   * 看完仍然不知道它们彼此有什么不同，还把本来能区分工具的简介挤掉了。
   * 所以这里统计每个依据在**本次结果集**里出现几次，超过一半的视为噪音，
   * 那些行退回简介。
   */
  const reasonNoise = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of toolResults) {
      const line = searchReason(h, trimmed).line;
      if (line) counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    const threshold = Math.max(3, Math.ceil(toolResults.length / 2));
    const noisy = new Set<string>();
    for (const [line, n] of counts) if (n >= threshold) noisy.add(line);
    return noisy;
  }, [toolResults, trimmed]);
  const catResults = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return navHotCategories.slice(0, 8);
    return navCategories
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
      .slice(0, 6);
  }, [trimmed]);

  if (!open) return null;

  return (
    // z-[60]：抽屉（mobile-nav）也是 z-50，而它在 DOM 里排在本组件之后，
    // 同层级时后渲染的抽屉会盖在面板上。这里把搜索面板抬到抽屉之上，
    // 抽屉本身由 header 保证与面板互斥（见 header.tsx）。
    <div className="fixed inset-0 z-[60]">
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
        // `animate-rise-in` 而不是 `animate-fade-in`：后者关键帧里的
        // `transform: none` 配 `fill-mode: both` 会永久覆盖 `-translate-x-1/2`，
        // 把面板顶到视口中线右侧 —— 移动端 42% 的面板在屏幕外，关闭按钮点不到。
        // 详见 tailwind.config.ts 里 `rise-in` 的注释。
        className="fixed left-1/2 top-[12vh] w-[92vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-rise-in"
      >
        <Command shouldFilter={false} loop className="w-full">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="搜索 AI 工具、分类，或直接说你想做什么…"
              aria-label="搜索 AI 工具"
              // `text-base md:text-sm`：16px 是 iOS Safari 聚焦时**不**强制放大
              // 页面的阈值（<16px 会让整页跳一下），桌面端再回到 14px。
              // 2026-10-23（task-2 第 6 条）：焦点环从 1px 提到 2px 并用
              // `ring-ring`（品牌深绿），与全站其余可交互元素同档。
              className="h-12 w-full rounded bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="关闭"
              // 原先只有 `focus-visible:ring-1` 且没有 `outline-none`：
              // 键盘聚焦时会同时出现一条浏览器默认蓝外框和一圈绿环。
              className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
            {/*
              空态用**普通 div**，不用 `<Command.Empty>`。

              cmdk 的 `Command.Empty` 只在 `state.filtered.count === 0` 时渲染，
              而 `filtered.count` 的计算在 cmdk 内部是：
                if (!search || shouldFilter === false) { filtered.count = 已注册项总数 }
              本面板传了 `shouldFilter={false}`（筛选是自己在 `searchIndex` 里做的），
              所以 `filtered.count` 恒等于**已注册的项数**，永远不是 0 ——
              `<Command.Empty>` 永远不渲染。

              结果就是：搜一个不存在的词，面板里空空如也，一句提示都没有，
              用户以为面板坏了。2026-10-19 实测 `[cmdk-empty]` 为 null。

              改成普通 div 后由我们自己控制显隐；`role="status"` 让读屏
              能念出「没有匹配」。
            */}
            {trimmed !== '' && toolResults.length === 0 && catResults.length === 0 && (
              <div
                role="status"
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                <p>没有直接匹配「{trimmed}」的工具。</p>
                <p className="mt-1 text-xs">换个说法再试，或去分类里逛逛。</p>
              </div>
            )}

            {/* 工具组在前：用户是来找工具的，回车应该落在工具上。 */}
            {toolResults.length > 0 && (
              <Command.Group
                heading={`工具 · ${toolResults.length}`}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {toolResults.map((h) => {
                  // 命中只带 slug，其余展示字段走 Map 查（避免每次渲染都在
                  // 2081 条里线性 find）。查不到就跳过，不让一条脏数据炸整组。
                  const t = CATALOG_BY_SLUG.get(h.slug);
                  if (!t) return null;
                  return (
                    <Command.Item
                      key={t.s}
                      value={t.s}
                      onSelect={() => go(`/tools/${t.s}`)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-accent/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset(t.i)}
                        alt=""
                        width={28}
                        height={28}
                        loading="lazy"
                        className="h-7 w-7 shrink-0 rounded-md border border-border object-contain p-0.5"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{t.n}</span>
                      {/* 右侧优先给「为什么它出现」：命中词 + 字段。没有命中依据
                          （比如只有推荐列表里的条目）才退回简介 —— 简介在搜索结果
                          里几乎每行都一样长，读者扫不出区别；命中词能解释排序。 */}
                      {(() => {
                        const reason = searchReason(h, trimmed);
                        // 整列重复的依据没有解释力（见 reasonNoise 的注释），退回简介。
                        const showReason = reason.line !== '' && !reasonNoise.has(reason.line);
                        return (
                          <span
                            className={
                              showReason
                                ? 'max-w-[55%] shrink-0 truncate text-2xs text-gongke-accent'
                                : 'max-w-[55%] truncate text-xs text-muted-foreground'
                            }
                          >
                            {showReason ? reason.line : t.d}
                          </span>
                        );
                      })()}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {catResults.length > 0 && (
              <Command.Group
                heading={trimmed ? '分类' : '热门分类'}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {catResults.map((c) => (
                  <Command.Item
                    key={c.slug}
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
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {trimmed === '' && (
              <Command.Group
                heading="常用推荐"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {navFeatured.slice(0, 5).map((t) => (
                  <Command.Item
                    key={t.slug}
                    value={`feat-${t.slug}`}
                    onSelect={() => go(t.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-accent/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.icon}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
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
          </Command.List>

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-2xs text-muted-foreground">
            <span className="hidden sm:inline">↑↓ 选择 · ↵ 打开 · Esc 关闭</span>
            {trimmed ? (
              // 30 条之外的出口：把原话带进 /tools，那里没有条数上限。
              <Command.Item
                value="__see-all__"
                onSelect={() => go(`/tools?q=${encodeURIComponent(trimmed)}`)}
                className="ml-auto flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-medium text-gongke-accent aria-selected:bg-gongke-accent/10"
              >
                在全部工具中搜索「{trimmed}」
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Command.Item>
            ) : (
              <span className="ml-auto">共 {CATALOG_INDEX.length} 个工具</span>
            )}
          </div>
        </Command>
      </div>
    </div>
  );
}
