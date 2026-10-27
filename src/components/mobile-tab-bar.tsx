'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Home, LayoutGrid, Newspaper, Search } from 'lucide-react';

/**
 * 移动端底部 Tab 栏 —— 这个站「APP 感」的主要来源。
 *
 * 为什么是底部栏而不是继续用汉堡菜单：手机上的拇指热区在屏幕下半部，汉堡菜单
 * 在右上角，单手够不到；而底部 Tab 是原生 APP 的通用形态，切换一级栏目只需要
 * 一次点击。汉堡菜单仍然保留（顶栏右上的按钮），因为它承载的是「常用推荐 /
 * 热门分类」这些二级入口，而底部栏只放四个一级栏目 + 搜索。
 *
 * 五个槽位、中间那个是凸起的搜索圆钮，这是 iOS/Android 常见的「主操作居中」
 * 布局。搜索不新开页面，而是派发 `tryworld:search` 事件，由 Header 里的
 * CommandDialog 监听 —— 这样搜索面板全站只有一份状态，不会出现「底部栏打开
 * 一个、顶栏又打开一个」的两套弹层。
 *
 * 安全区：`pb-[env(safe-area-inset-bottom)]` 兜住 iPhone 的 Home 指示条；
 * 页面内容在 `layout.tsx` 里留了同样的下边距，避免最后一行被盖住。
 *
 * 只在 `lg` 以下显示。桌面端的侧栏已经覆盖了同样的导航。
 */

const TABS = [
  { href: '/', label: '首页', icon: Home, match: (p: string) => p === '/' },
  {
    href: '/tools',
    label: '工具',
    icon: LayoutGrid,
    // 分类与集合同属「目录」这条动线，合并到一个槽位后，`/categories` 与
    // `/collections` 仍然有可见的选中态（否则用户在分类页会觉得「没在任何一个
    // 栏目里」）。腾出来的槽位给了 `/decide`。
    match: (p: string) =>
      p.startsWith('/tools') || p.startsWith('/categories') || p.startsWith('/collections'),
  },
  // 中间的搜索按钮占位，实际按钮在下面单独渲染。
  { href: '', label: '', icon: Search, match: () => false },
  {
    href: '/decide',
    label: '帮我选',
    icon: Compass,
    match: (p: string) => p.startsWith('/decide'),
  },
  {
    href: '/news',
    label: '资讯',
    icon: Newspaper,
    match: (p: string) => p.startsWith('/news'),
  },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/5 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      data-testid="mobile-tab-bar"
    >
      <ul className="grid grid-cols-5 items-end px-1">
        {TABS.map((tab, i) => {
          if (i === 2) {
            return (
              <li key="search" className="flex justify-center">
                {/* 凸起的搜索圆钮：`-translate-y-3` 让它探出栏顶，白色描边把
                    它与页面内容隔开，阴影给一点悬浮感。按压时缩小，和站内所有
                    按钮的 `active:scale` 手感一致。 */}
                <button
                  type="button"
                  aria-label="搜索 AI 工具"
                  onClick={() => window.dispatchEvent(new CustomEvent('tryworld:search'))}
                  className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-gongke-accent text-white shadow-lg shadow-gongke-accent/25 ring-4 ring-white transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gongke-accent"
                  data-testid="tab-search"
                >
                  <Search className="h-5 w-5" aria-hidden="true" />
                </button>
              </li>
            );
          }

          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link prefetch={false}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`group flex flex-col items-center gap-0.5 rounded-xl py-2 text-2xs transition-colors duration-150 active:scale-95 ${
                  active ? 'text-gongke-accent' : 'text-gongke-muted'
                }`}
                data-testid={`tab-${tab.href === '/' ? 'home' : tab.href.slice(1)}`}
              >
                <span className="relative flex h-6 w-8 items-center justify-center">
                  {/* 选中态的小圆点：比单纯变色更容易在余光里分辨。 */}
                  <span
                    className={`absolute inset-x-1 inset-y-0 rounded-full transition-all duration-200 ${
                      active ? 'scale-100 bg-gongke-accent/10 opacity-100' : 'scale-50 opacity-0'
                    }`}
                    aria-hidden="true"
                  />
                  <Icon
                    className={`relative h-[18px] w-[18px] transition-transform duration-200 ${
                      active ? 'scale-110' : 'group-hover:scale-105'
                    }`}
                    strokeWidth={active ? 2.4 : 1.8}
                    aria-hidden="true"
                  />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
