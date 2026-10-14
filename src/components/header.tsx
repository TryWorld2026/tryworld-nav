'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LayoutList, Layers2, Menu, ScanFace, Search } from 'lucide-react';
import { CommandDialog } from './command-dialog';
import { MobileNav } from './mobile-nav';
import { SiteLogo } from './site-logo';
import { CategoryIcon } from './category-icon';
import { allCategories, SITE } from '@/lib/data';

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
 * The origin's 登录/注册 button, verbatim. It is a three-layer background: the
 * solid fill, a fade, and the animated `--color-*` sweep that also feeds the
 * blurred `::before` glow.
 */
const MAGIC_BUTTON_CLASS =
  'group relative inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-[length:200%] px-8 py-2 font-medium text-primary-foreground transition-colors [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:bg-[linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))] before:[filter:blur(calc(0.8*1rem))] bg-[linear-gradient(#121213,#121213),linear-gradient(#121213_50%,rgba(18,18,19,0.6)_80%,rgba(18,18,19,0)),linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))] text-sm';

/** The three top-level nav items share this exact class string in the origin. */
const NAV_ITEM_CLASS =
  'font-medium text-foreground/70 hover:text-foreground/80 inline-flex items-center';

export function Header() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" is a browser shortcut on its own in places (Firefox's quick-find,
      // macOS's various), so leave modified chords alone.
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setCatOpen(false);
        setAuthOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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
      <header className="supports-backdrop-blur:bg-background/90 sticky top-0 z-40 w-full border-b border-foreground/5 bg-background/40 backdrop-blur-lg">
        <div className="relative">
          <div className="px-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-6">
                {/* Mobile-only lockup: this is where the sidebar's brand block
                    would be, but the sidebar is `hidden lg:block`. */}
                <Link href="/" className="flex items-center lg:hidden">
                  {/* 主标是宽幅的（192×116），宽度 + `h-auto` 保持比例。 */}
                  <SiteLogo className="w-8 h-auto text-gongke-dark mr-2" />
                  <div className="text-xl text-foreground font-bold font-display">{SITE.name}</div>
                </Link>

                <nav className="hidden lg:flex items-center text-sm space-x-6">
                  <Link href="/tools" className={NAV_ITEM_CLASS}>
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
                              <Link
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
                      </div>
                    )}
                  </div>

                  <Link href="/about" className={NAV_ITEM_CLASS}>
                    <ScanFace className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    关于我们
                  </Link>
                </nav>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Search"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-gongke-muted hover:bg-gongke-gray/10 transition-colors"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline text-sm">
                    搜索AI工具
                    <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </span>
                </button>

                <div className="hidden lg:block">
                  <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className={MAGIC_BUTTON_CLASS}
                  >
                    登录/注册
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Toggle mobile menu"
                  className="lg:hidden p-2 text-foreground/80"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <CommandDialog open={open} onOpenChange={setOpen} />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />

      {authOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAuthOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="登录/注册"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold text-foreground">登录/注册</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              复刻版本未包含账号系统，登录与注册暂不可用。
            </p>
            <button
              type="button"
              onClick={() => setAuthOpen(false)}
              className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              知道了
            </button>
          </div>
        </div>
      )}
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
