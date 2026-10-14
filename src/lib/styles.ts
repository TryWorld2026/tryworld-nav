/**
 * The origin's shadcn/ui button class strings, verbatim.
 *
 * The origin builds its buttons from the stock shadcn `buttonVariants` helper
 * (cva), which this repo does not carry — and should not, for two buttons. The
 * generated strings live here instead, kept as single constants so the origin's
 * exact class list is still readable in one place and the tool page stays
 * declarative.
 *
 * `outline` — 分享 / 添加收藏 on the tool page.
 */
export const buttonOutline =
  'justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-background/90 hover:text-foreground h-9 px-4 py-2 flex items-center gap-2 text-foreground';

/**
 * `default` (primary) — 访问官网 on the tool page.
 */
export const buttonPrimary =
  'justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 flex items-center gap-2';
