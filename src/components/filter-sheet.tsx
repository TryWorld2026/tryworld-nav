'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';

/**
 * <1024px 的筛选抽屉（底部上滑）。
 *
 * 为什么是抽屉而不是继续用「折叠成 8 个 + 全部展开」：390×844 的实测里，
 * 26 个分类即使折成 8 个也占了 404px，首屏一张工具卡都露不出来。把四组筛选
 * 整体移进抽屉之后，`/tools` 的首屏 = 搜索框 + 工具条 + 两张卡。
 *
 * 五个边界条件（都不显眼，但少一个就会被读者撞见）：
 *
 *   1. **背景滚动锁**复用 `useBodyScrollLock`（计数版）。它用 `overflow: hidden`
 *      而不是 `position: fixed` —— 后者在 iOS 上会让页面跳回顶部，而「关掉抽屉
 *      后还停在原来的滚动位置」正是这个页面的核心动作（筛一下、看一眼、继续滚）。
 *   2. **Esc 与点遮罩都关闭**。遮罩是 `aria-hidden` 的 div，不是按钮 —— 键盘
 *      用户走 Esc，触屏用户走点击，两条路都要有。
 *   3. **视口变宽要自动关**。抽屉在 `lg` 以上被 `lg:hidden` 藏起来，但滚动锁
 *      还在：旋转 iPad 或拉宽窗口之后，页面会完全滚不动，而且屏幕上找不到
 *      任何原因。`matchMedia` 变化时直接关闭。
 *   4. **焦点**：打开时移到关闭按钮，关闭时还给触发的那个「筛选」按钮；
 *      `aria-modal` 承诺了背景不可交互，所以 Tab 也必须留在抽屉里。
 *   5. **高度用 `dvh`**：iOS 地址栏伸缩时 `vh` 不变、`dvh` 跟着变，写 `vh`
 *      会让抽屉底部的两个按钮被 Home 指示条压住。
 */
export function FilterSheet({
  open,
  onClose,
  onClear,
  activeCount,
  resultCount,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  activeCount: number;
  resultCount: number;
  children: ReactNode;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 边界条件 3：变宽就关。`sync()` 立刻跑一次，覆盖「在宽屏上被程序化打开」
  // 这种不该发生但一旦发生就会锁死页面的情况。
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (mq.matches) onClose();
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [open, onClose]);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // 等一帧：抽屉刚挂载时里面的按钮还没布局完，直接 focus 会落空。
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open]);

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
        className="fixed inset-0 z-50 animate-[sheet-fade_0.2s_ease-out] bg-gongke-dark/40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        id="tools-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="筛选"
        onKeyDown={onPanelKeyDown}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-background shadow-2xl animate-[sheet-up_0.28s_cubic-bezier(0.22,1,0.36,1)] lg:hidden"
      >
        {/* 拖拽条：纯视觉，但它是「这个面板可以往下甩」的唯一暗示。 */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/15" aria-hidden="true" />

        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
          <h2 className="font-display text-base font-semibold text-foreground">
            筛选
            {activeCount > 0 && (
              <span className="ml-1.5 align-middle text-xs font-normal text-muted-foreground">
                {activeCount} 项生效
              </span>
            )}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="关闭筛选"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 transition-colors duration-200 hover:bg-foreground/5"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 唯一可滚的区域：四组筛选。`min-h-0` 是 flex 子项能真正收缩的前提，
            少了它 `overflow-y-auto` 不生效、内容把底部按钮顶出屏幕。 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <Button variant="outline" onClick={onClear} className="min-h-11 border-border">
            清除全部
          </Button>
          <Button onClick={onClose} className="min-h-11">
            查看 {resultCount} 个结果
          </Button>
        </div>
      </div>
    </>
  );
}
