'use client';

import { Search } from 'lucide-react';
import { useModKey } from '@/lib/use-mod-key';

/**
 * 首页首屏的搜索入口。
 *
 * 为什么需要它：全站搜索只在页眉有一个按钮，而 `lg` 断点上那个按钮的文字
 * 是隐藏的（`lg:hidden xl:inline`）—— 一个工具导航站，首屏最想让人做的事
 * 「说一句你想做什么」在 1024–1279 与所有手机上根本没有可见入口。页眉按钮
 * 与底部 Tab 圆钮都还在，但它们都不是「读到这里就想搜」的位置。
 *
 * 为什么是按钮而不是真的 `<input>`：全站只有一份搜索状态（`CommandDialog`，
 * 由页眉持有）。这里放真输入框就会出现两套 query、两个结果列表、两份键盘
 * 处理，且首屏输入框与面板打开后的输入框会互相抢焦点。所以这里是一个
 * **长得像输入框的按钮**，点击派发 `tryworld:search` 事件交给页眉打开面板
 * —— 与移动端底部圆钮同一套机制，全站仍然只有一份搜索状态。
 *
 * 无障碍：它是 `<button type="button">` 而不是 div，`aria-label` 写明「打开
 * 搜索面板」，键盘可达、有 focus ring。**不能**加 `role="combobox"`：那是给
 * 真输入框的语义，用在这里会让读屏用户以为可以直接输入。
 *
 * 2026-10-27：垂直节奏交给调用方（`className`），组件不再写死 `mt-7`。
 * 首屏预算按屏高分配时，hero 内部每一段间距都要能被 hero 统一调节 ——
 * 一个组件自带 `mt-7` 就把 28px 钉死了，矮屏上只能靠整体 padding 兜。
 */
export function HeroSearch({ className = '' }: { className?: string }) {
  const modKey = useModKey();

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('tryworld:search'))}
      aria-label="打开搜索面板，搜索 AI 工具"
      data-testid="hero-search"
      className={`group flex w-full max-w-[34rem] items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-left backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gongke-paper/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gongke-dark active:scale-[0.995] ${className}`}
    >
      <Search
        className="h-4 w-4 shrink-0 text-gongke-paper/55 transition-colors group-hover:text-gongke-paper/80"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-gongke-paper/60 transition-colors group-hover:text-gongke-paper/80">
        搜工具名、简介，或直接说你想做什么…
      </span>
      <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-2xs font-medium text-gongke-paper/60 sm:inline-flex">
        {modKey}K
      </kbd>
    </button>
  );
}
