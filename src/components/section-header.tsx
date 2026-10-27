import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * A section heading row.
 *
 * 2026-10-17 重做。原来是一行 18px 粗体 + 右侧一个小描边按钮，字号与下面的
 * 卡片标题只差 2px，26 个分类区块全部长一样 —— 整页滚下来没有任何节奏，
 * 用户说的「排版粗糙、缺少层次」主要就是这里。
 *
 * 现在的层级：
 *
 *   - 区块标题 20px（`text-xl`），前面一个品牌绿的小图标块（32px 的浅绿底圆角
 *     方）而不是悬空的 20px 线条图标 —— 图标有了「底」，标题行就有了起点；
 *   - 标题右侧跟一条**发丝线**铺满剩余宽度，把标题与「查看更多」连成一行，
 *     视线不会在中间断掉；
 *   - 「查看更多」平时是灰字，hover 才变绿并右移箭头 —— 区块标题不该和内容
 *     抢注意力，原站的描边按钮在 26 个区块里重复 26 次，太重。
 *
 * `compact` 保留原语义：分类区块的外层已经用 `space-y-4` 管住间距，这一行
 * 不再自己加 `mb-4`。
 */
export function SectionHeader({
  title,
  href,
  linkLabel = '查看更多',
  icon,
  id,
  compact = false,
  aside,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  icon?: React.ReactNode;
  id?: string;
  compact?: boolean;
  /** 标题行里的旁注（例如「热门工具」右侧的体量数字）。 */
  aside?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3${compact ? '' : ' mb-4'}`}
    >
      <h2
        className="flex shrink-0 items-center gap-2.5 text-xl font-semibold text-foreground"
        id={id}
      >
        {icon && (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gongke-accent/[0.07] text-gongke-accent ring-1 ring-inset ring-gongke-accent/10"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {title}
      </h2>

      {/* 发丝线：从标题一直铺到右侧的链接，把两者钉在同一行上。 */}
      <span className="h-px min-w-4 flex-1 bg-foreground/10" aria-hidden="true" />

      {/* 旁注：贴着「查看更多」左侧，与标题同一基线。窄屏放不下，由调用方
          在标题下方另给一份（同一组件、同一份数据）。 */}
      {aside && <div className="hidden shrink-0 lg:block">{aside}</div>}

      {href && (
        <Link prefetch={false}
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-gongke-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {linkLabel}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
