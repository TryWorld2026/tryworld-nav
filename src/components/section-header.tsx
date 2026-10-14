import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * The outline button that carries 查看全部 / 查看更多, verbatim from the
 * origin's React tree (flight chunk `33:`).
 */
const MORE_BUTTON_CLASS =
  'justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 border bg-background shadow-sm hover:bg-background/90 hover:text-foreground h-9 px-4 py-2 flex text-foreground/80 items-center border-gongke-gray/20';

/**
 * A section heading row, verbatim from the origin.
 *
 * The origin has three of these on the home page and they differ in exactly
 * three ways, which is why `href`, `linkLabel`, `icon`, `id` and `compact` are
 * all optional:
 *
 *   热门工具      wrapper `mb-12`, row `mb-4`, Rocket 20×20, 查看全部 → /tools
 *   最新添加      wrapper (none),  row `mb-4`, ConciergeBell 20×20, no link
 *   26 categories wrapper `mt-8 space-y-4`, row `gap-4` only (no `mb-4`),
 *                a 20×20 category icon, 查看更多 → /categories/{slug}, and an
 *                `id` on the `<h2>` so the sidebar's category list can anchor
 *                straight to it.
 *
 * `compact` is the origin's category-row case: the wrapper already owns the
 * vertical rhythm (`space-y-4`), so the row must not add its own `mb-4`.
 */
export function SectionHeader({
  title,
  href,
  linkLabel = '查看更多',
  icon,
  id,
  compact = false,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  icon?: React.ReactNode;
  id?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between${
        compact ? '' : ' mb-4'
      }`}
    >
      <div>
        <h2 className="flex items-center text-lg font-bold text-foreground/80" id={id}>
          <span className="mr-2 text-gray-500">{icon}</span>
          {title}
        </h2>
      </div>

      {href && (
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          {/* The origin nests a <button> inside this <a>. That is invalid HTML
              (interactive content inside interactive content), so the button's
              own classes are applied to the anchor instead — same rendered
              result, valid document. */}
          <Link href={href} className={`hidden md:block ${MORE_BUTTON_CLASS}`}>
            {linkLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
