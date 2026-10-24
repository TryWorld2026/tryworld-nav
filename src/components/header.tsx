'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bookmark, ChevronDown, Compass, LayoutList, Layers2, Menu, Newspaper, ScanFace, Search } from 'lucide-react';
import { CommandDialog } from './command-dialog';
import { MobileNav } from './mobile-nav';
import { NavMark } from './nav-mark';
import { CategoryIcon } from './category-icon';
import { navCategories as allCategories } from '@/lib/nav';
import { SITE } from '@/lib/site';
import { useModKey } from '@/lib/use-mod-key';

/**
 * The origin's header, transcribed from its markup.
 *
 * Two things here are a functional reading of content the origin never ships in
 * its HTML, and both are called out rather than hidden:
 *
 *   1. The 所有分类 trigger renders a Radix NavigationMenu whose content div is
 *      empty in the SSR'd HTML — the origin hydrates the panel from the client,
 *      so the real item list is not in any captured document. No Radix packages
 *      are dependencies here, so the trigger is hand-rolled and its panel lists
 *      all 26 categories from `categories.json`. The trigger's own classes,
 *      icon, chevron and rotation behaviour are the origin's.
 *   2. The 登录/注册 button is the origin's "magic border" gradient button. Its
 *      dialog body is equally uncaptured (`DialogDescription`, 忘记密码, 验证码
 *      and 手机号 are all absent from the saved pages), so the replica's click
 *      opens a one-line panel that says so instead of a fabricated form.
 *
 * The gradient the button is drawn from is `--color-1..5`, which the origin
 * declares in both `:root` and `.dark`.
 */

/**
 * The origin's 登录/注册 button. It is a three-layer background: the solid
 * fill, a fade, and the `--color-*` sweep that `background-clip: border-box`
 * paints as a hairline gradient ring around the button.
 *
 * 与原站的唯一差异：原站还有一个 `before:` 模糊光晕（`bottom-[-20%]` +
 * `blur(0.8rem)`），从按钮下沿溢出来。原站页眉是深底，光晕融在里面像辉光；
 * 本站页眉是纸色（#F2EEE6），同一块光晕在浅底上读起来是**一块彩色污渍**，
 * 而且页眉下沿正好有一条发丝线，光晕会越过它渗进内容区 —— 2560 截图里
 * 表现为「登录/注册」正下方一团绿橙残影。
 *
 * 按钮的「魔法描边」本身不依赖这个光晕：三层背景的第三层由
 * `[background-clip:padding-box,border-box,border-box]` + 透明边框裁出一圈
 * 渐变环，去掉光晕后描边仍在。所以这里只删 `before:*` 那一段。
 */
/**
 * 右上角的主按钮 —— 2026-10-18 从「登录/注册」换成「我的收藏」。
 *
 * 换掉的原因（这是本轮最伤信任的一处，见 work/analysis-ia.md §9②）：
 * 原按钮点开是一个 hand-rolled 弹窗，正文写着「复刻版本未包含账号系统，登录与
 * 注册暂不可用」。它是首屏视觉权重第二高的元素（仅次于 logo），第一次到访的
 * 用户点下去就被告知「这是个没做完的复制站」；而 `/about` 又写着「没有账号
 * 体系」，两处自相矛盾。
 *
 * 静态站确实做不了账号，但可以做「收藏 + 本机可见」：详情页的收藏按钮从
 * 2026-10 起就一直在往 localStorage 写数据，只是全站没有出口。现在这个按钮
 * 指向 `/favorites`，一个真实的、能在本机工作的页面。
 *
 * 视觉沿用原登录按钮的「深墨实心 + 描边」体量（h-11 / px-5），保留首屏的
 * 右侧重量，但不再使用那套 `--color-1..5` 渐变描边（它是原站深底页眉的产物，
 * 在纸色底上读起来像一块彩色污渍，注释见上方 FAVORITES_BUTTON_CLASS 处）。
 */
const FAVORITES_BUTTON_CLASS =
  'group inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gongke-dark px-5 text-sm font-medium text-[#F2EEE6] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#253230] hover:shadow-lg hover:shadow-[#1B2523]/20 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gongke-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** The three top-level nav items share this exact class string in the origin. */
const NAV_ITEM_CLASS =
  'font-medium text-foreground/70 hover:text-foreground/80 inline-flex items-center';

/**
 * 「AI 资讯」是本轮新增的第四个导航项，原站没有对应入口——试界自己做了
 * AIHOT 聚合栏目，必须让它在桌面导航里可见（用户反馈「界面上看不到新闻资讯
 * 的按钮和界面」）。图标与字号沿用上面三个原站项的规格（`w-3.5 h-3.5 mr-1`），
 * 所以四个项的高度与视觉重量保持一致，不会出现某一项特别突出。
 */
const NEWS_NAV_CLASS = `${NAV_ITEM_CLASS} relative`;

/**
 * 「帮我选」—— 2026-10-23 新增的第五个导航项，也是全站唯一被**视觉强调**的
 * 导航项（其余四项都是幽灵行）。
 *
 * 为什么它值得一块底色：这个站的 2081 条目录本身没有壁垒（任何站都能扒同一份
 * 名单），真正独有、且别人抄不走的是 363 条人工判断 + 「不适合谁」那一行。
 * 但在此之前，这些判断只能从「某个工具详情页」偶遇，用户没有一条「我现在就要
 * 做决定」的入口。`/decide` 就是那条入口；导航里把它和「查看全部」并列而不是
 * 塞进下拉，等于在页眉上写清楚这站卖的是**决定**，不是**名单**。
 *
 * 尺寸沿用其余项的 h-9（不破坏页眉一行的节奏），只加一层极淡的绿底与描边，
 * 用色相而不是体量来区分主次 —— 页眉右上已经有一个深墨实心按钮（我的收藏），
 * 再来一个实心块会让右边重量翻倍。
 */
const DECIDE_NAV_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-gongke-accent/30 bg-gongke-accent/[0.06] px-3 text-[13px] font-medium text-gongke-accent transition-colors hover:border-gongke-accent/45 hover:bg-gongke-accent/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function Header() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  /**
   * 搜索面板与移动抽屉**互斥**。
   *
   * 原先两者可以同时打开：抽屉是底部弹层，但页眉仍然可见，用户在抽屉开着
   * 的时候点页眉的搜索键（或按 Ctrl+K）就会叠出第二层弹窗。两层都是
   * `aria-modal="true"`、都锁 `body` 滚动，而且各自保存/还原
   * `body.style.overflow` —— 谁后关谁会把另一个的 `hidden` 抹掉，页面开始
   * 在弹层底下滚。
   *
   * 现在开一个就关另一个：底部 Tab 栏的搜索圆钮与页眉搜索键走同一条路径，
   * 行为一致。
   */
  const openPalette = useCallback((v: boolean) => {
    setOpen(v);
    if (v) setMenuOpen(false);
  }, []);
  const openDrawer = useCallback((v: boolean) => {
    setMenuOpen(v);
    if (v) setOpen(false);
  }, []);
  const [mounted, setMounted] = useState(false);
  /**
   * 当前平台的主修饰键 —— macOS / iOS 是 `⌘`，其余是 `Ctrl`。抽到
   * `lib/use-mod-key.ts` 是因为首页 hero 的搜索入口也要显示同一个提示，
   * 两处各写一遍就会有一天只改了一处。
   *
   * 默认 `Ctrl`（SSR 与首次渲染都用它），挂载后若是 macOS/iPadOS 再换成 `⌘`。
   * 快捷键本身两个键都认（`e.metaKey || e.ctrlKey`），但提示写死 `⌘K` 会让
   * Windows/Linux 用户按了没反应 —— 而本站读者大多数在 Windows 上。服务端
   * 不知道客户端平台，所以先渲染 `Ctrl`；差异只有一个 kbd 徽章，不会造成
   * 可见跳动。
   */
  const modKey = useModKey();
  /** 滚动方向：向下滚时收起顶栏，向上滚时立刻出现。 */
  const [hidden, setHidden] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const lastY = useRef(0);

  useEffect(() => setMounted(true), []);

  /**
   * 阅读时让位给内容：向下滚超过一屏的一半才收起，往回滚 8px 就出现。
   *
   * 两个阈值不对称是故意的 —— 收起要「确认用户真的在往下读」，出现要「一有
   * 回看的意图就响应」。否则轻微的惯性抖动会让顶栏反复抽搐。接近页顶（<80px）
   * 时永远显示，避免在首屏就藏掉导航。
   */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (y < 80) setHidden(false);
      else if (dy > 6 && y > 160) setHidden(true);
      else if (dy < -8) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * 底部 Tab 栏的搜索圆钮不自己弹一个面板，而是派发 `tryworld:search`，
   * 由这里打开唯一的 CommandDialog。全站只有一份搜索状态，不会出现两套弹层
   * 叠在一起，也不会因为两处各自维护 query 而互相覆盖。
   */
  useEffect(() => {
    const onSearch = () => openPalette(true);
    window.addEventListener('tryworld:search', onSearch as EventListener);
    return () => window.removeEventListener('tryworld:search', onSearch as EventListener);
  }, [openPalette]);

  /**
   * 把顶栏的**实际高度**写进根元素的 CSS 变量 `--site-header-h`，供
   * `news-tabs.tsx` 的 sticky 频道栏做偏移；顶栏收起后置 0，频道栏顶上补位。
   *
   * 为什么量而不是写死：顶栏在 lg 以下只有搜索与汉堡（约 52px），lg 以上多出
   * 一个 h-11 的登录按钮（约 60px），两个断点不一样。写死一个值必然有一个
   * 断点对不齐，而 sticky 偏移错 8px 就会出现一条穿帮的缝隙。
   */
  useEffect(() => {
    const el = headerRef.current;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty('--site-header-h', hidden ? '0px' : `${el?.offsetHeight ?? 0}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      root.style.removeProperty('--site-header-h');
    };
  }, [hidden]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openPalette(!open);
        return;
      }
      // "/" is a browser shortcut on its own in places (Firefox's quick-find,
      // macOS's various), so leave modified chords alone.
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        openPalette(true);
      }
      if (e.key === 'Escape') {
        setCatOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, openPalette]);

  // A click anywhere outside the category panel closes it. `mousedown` rather
  // than `click` so a press inside the panel that ends on a link still counts
  // as inside.
  useEffect(() => {
    if (!catOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [catOpen]);

  return (
    <>
      <header
        ref={headerRef}
        data-hidden={hidden ? 'true' : 'false'}
        className={`supports-backdrop-blur:bg-background/90 sticky top-0 z-40 w-full border-b bg-background/40 backdrop-blur-lg transition-[transform,border-color,box-shadow] duration-300 ease-out ${
          hidden ? '-translate-y-full border-transparent' : 'translate-y-0 border-foreground/5'
        }`}
      >
        <div className="relative">
          {/* 顶栏的左右内容也要落在同一条竖线上，否则宽屏下 logo 贴左、登录
              按钮贴右，与下面的正文完全对不齐。 */}
          {/* 顶栏改成三栏网格（品牌/菜单/动作）：两侧内容各占 1fr，中间导航
              真正居中。原先 `justify-between` 让导航贴着左侧品牌走，宽屏下
              四个菜单项挤在左三分之一，右侧留一大片空白 —— 顶栏看起来像
              没排完。 */}
          <div className="content-container">
            {/* 手机上导航是 `hidden`，三栏网格的中间格宽度为 0 —— 两侧各剩
                `1fr`，品牌名会被挤到折行（390px 实测折成「试界导 / 航」两行）。
                所以只有 `lg` 以上才切三栏，手机仍是两端对齐的两栏。 */}
            <div className="flex items-center justify-between py-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
              <div className="flex min-w-0 items-center space-x-6">
                {/* Mobile-only lockup: this is where the sidebar's brand block
                    would be, but the sidebar is `hidden lg:block`. */}
                <Link prefetch={false} href="/" className="flex min-w-0 items-center lg:hidden">
                  {/* 导航站子品牌标志（罗盘）—— 母品牌 tw 主标已用在作者个人
                      网站，这里按品牌规范《标志与子品牌》另立独立图形。
                      方形 viewBox（48×48），所以不再需要 `h-auto`。 */}
                  <NavMark className="mr-2 h-8 w-8 shrink-0 text-gongke-dark" />
                  <div className="truncate text-xl font-bold font-display text-foreground">
                    {SITE.name}
                  </div>
                </Link>
              </div>

              {/* 导航是网格的第二格（`auto` 宽），因此**必须**是
                  `grid-cols-[1fr_auto_1fr]` 的直接子元素才能居中；放在左侧
                  那个 `1fr` 格子里时它只会贴左。 */}
              <nav className="hidden items-center space-x-6 text-sm lg:flex">
                {/* 决策入口放在第一位：读者的第一问题永远是「我该用哪个」，
                    而不是「你们收了哪些」。见上面 DECIDE_NAV_CLASS 的说明。 */}
                <Link prefetch={false} href="/decide" className={DECIDE_NAV_CLASS} data-testid="decide-nav-link">
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  帮我选
                </Link>

                <Link prefetch={false} href="/tools" className={NAV_ITEM_CLASS}>
                  <LayoutList className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  查看全部
                </Link>

                {/* See the note at the top of this file. */}
                <div ref={catRef} className="relative">
                  <button
                    type="button"
                    data-state={catOpen ? 'open' : 'closed'}
                    aria-expanded={catOpen}
                    aria-haspopup="true"
                    onClick={() => setCatOpen((v) => !v)}
                    className="group inline-flex h-9 w-max items-center justify-center rounded-md py-2 text-sm transition-colors group font-medium text-foreground/70 hover:text-foreground/80 px-0"
                  >
                    <Layers2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    所有分类
                    <ChevronDown
                      className="relative top-[1px] ml-1 h-3 w-3 transition duration-300 group-data-[state=open]:rotate-180"
                      aria-hidden="true"
                    />
                  </button>

                  {catOpen && (
                    <div className="absolute left-1/2 top-full z-50 mt-1 w-[34rem] -translate-x-1/2 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg">
                      <ul className="grid grid-cols-3 gap-0.5">
                        {allCategories.map((c) => (
                          <li key={c.slug}>
                            <Link prefetch={false}
                              href={`/categories/${c.slug}`}
                              onClick={() => setCatOpen(false)}
                              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
                            >
                              <CategoryIcon name={c.icon} className={`h-4 w-4 shrink-0 ${c.tailwind}`} />
                              <span className="truncate">{c.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {/* 下拉里原先只有 26 个分类，没有通向「分类总览」或
                          「精选集合」的路 —— 桌面端去 /categories 的唯一入口
                          埋在首页下半屏。两个出口放到底部一条细线之后。 */}
                      <div className="mt-1.5 flex items-center gap-3 border-t border-foreground/[0.07] px-2 pt-2 text-[12.5px]">
                        <Link prefetch={false}
                          href="/categories"
                          onClick={() => setCatOpen(false)}
                          className="inline-flex items-center gap-1 font-medium text-gongke-accent hover:underline"
                        >
                          分类总览
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                        <Link prefetch={false}
                          href="/collections"
                          onClick={() => setCatOpen(false)}
                          className="inline-flex items-center gap-1 font-medium text-gongke-accent hover:underline"
                        >
                          精选集合
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                        <Link prefetch={false}
                          href="/favorites"
                          onClick={() => setCatOpen(false)}
                          className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          我的收藏
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <Link prefetch={false} href="/about" className={NAV_ITEM_CLASS}>
                  <ScanFace className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  关于我们
                </Link>

                {/* 见文件顶部 NEWS_NAV_CLASS 处的说明。插在「关于我们」之前，
                    与右侧搜索按钮相邻，扫读顺序是「目录 -> 资讯 -> 关于」。 */}
                <Link prefetch={false} href="/news" className={NEWS_NAV_CLASS} data-testid="news-nav-link">
                  <Newspaper className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  AI 资讯
                </Link>
              </nav>

              <div className="flex items-center space-x-3 lg:justify-self-end">
                <button
                  type="button"
                  onClick={() => openPalette(true)}
                  aria-label="搜索AI工具"
                  className="flex shrink-0 items-center space-x-2 rounded-md px-3 py-2 text-gongke-muted transition-colors hover:bg-gongke-gray/10"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden text-sm md:inline lg:hidden xl:inline">
                    搜索AI工具
                    <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                      <span className="text-xs">{modKey}</span>K
                    </kbd>
                  </span>
                </button>

                <div className="hidden lg:block">
                  {/* 指向真实的 /favorites，不再弹「未包含账号系统」的说明框。 */}
                  <Link prefetch={false} href="/favorites" className={FAVORITES_BUTTON_CLASS}>
                    <Bookmark className="h-4 w-4" aria-hidden="true" />
                    我的收藏
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => openDrawer(true)}
                  aria-label="打开导航菜单"
                  className="lg:hidden p-2 text-foreground/80"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <CommandDialog open={open} onOpenChange={openPalette} />
      <MobileNav open={menuOpen} onClose={() => openDrawer(false)} />
    </>
  );
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  // SELECT too: "/" while a dropdown has focus is the browser's type-ahead.
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
