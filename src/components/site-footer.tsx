import { ArrowUpRight, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { NavMark } from './nav-mark';
import { SITE } from '@/lib/site';

/**
 * The origin's footer, verbatim from its markup.
 *
 * Three structural notes:
 *
 * - It has no max-width wrapper. Every other container in the site caps at
 *   1536px; the footer does not, so on a wide viewport its content runs to the
 *   edge and only the `px-4 sm:px-8` gutter stands between it and the border.
 * - The second column's right half *was* an empty `<div className="md:w-1/2">`.
 *   It is in the origin and was reproduced rather than dropped, because without
 *   it the link list would stretch to fill the two-thirds. That is now the
 *   AI 资讯 column: the width role is preserved (the link list still occupies
 *   only its own half), but the slot holds content instead of nothing. This is
 *   a deliberate departure from the origin, for the same reason the sidebar's
 *   news block is one — see `site-sidebar.tsx`.
 * - 友情链接 is *not* here. It is home-page-only, and it is the *last* element
 *   of the page body — the origin's shell flushes `$RS("S:2","P:2")` straight
 *   after it, and `P:1`/`P:2` are the shell's document-order Suspense
 *   placeholders, so nothing follows. It lives in `src/app/page.tsx`.
 */
export function SiteFooter() {
  return (
    <footer className="bg-background border-t border-foreground/5 py-8">
      <div className="content-container">
        <div className="md:flex md:justify-between">
          <div className="md:w-1/3 mb-6 md:mb-0">
            <Link prefetch={false} href="/" className="flex items-center mb-2">
              {/* 导航站子品牌标志（罗盘）—— 母品牌 tw 主标已用在作者个人网站。 */}
              <NavMark className="mr-2 h-8 w-8 text-gongke-dark" />
              <div className="text-xl text-foreground font-bold font-display">{SITE.name}</div>
            </Link>
            <p className="text-sm text-gongke-muted">
              © 2026{' '}
              <Link prefetch={false} href="/" className="inline-flex min-h-6 items-center hover:text-accent">
                {SITE.name}
              </Link>{' '}
              版权所有
            </p>
            {/* 原站这一列还挂着它的 ICP 备案号与公安备案徽标。那是另一家公司
                的真实备案，换牌时整块删掉；本站在取得自己的备案号之前不显示
                备案行。 */}
          </div>

          <div className="md:w-2/3 md:flex">
            <div className="md:w-1/2 mb-6 md:mb-0">
              <ul className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
                <li>
                  <Link prefetch={false}
                    className="inline-flex min-h-6 items-center text-sm text-foreground hover:text-gongke-accent"
                    href="/about"
                  >
                    关于我们
                  </Link>
                </li>
                <li>
                  <Link prefetch={false}
                    className="inline-flex min-h-6 items-center text-sm text-foreground hover:text-gongke-accent"
                    href="/terms-conditions"
                  >
                    用户协议
                  </Link>
                </li>
                <li>
                  {/* 原站的「提交工具」指向它自己的飞书表单，属于另一家公司的
                      入口，换牌时去掉。现在这一格改成真实可用的「我的收藏」+
                      「精选集合」—— 页脚原先只有 4 个链接，却挂着一条「即将开放」
                      的死文案，是导航站最不该有的兜底空洞。 */}
                  <Link prefetch={false}
                    className="inline-flex min-h-6 items-center text-sm text-foreground hover:text-gongke-accent"
                    href="/favorites"
                  >
                    我的收藏
                  </Link>
                </li>
                <li>
                  <Link prefetch={false}
                    className="inline-flex min-h-6 items-center text-sm text-foreground hover:text-gongke-accent"
                    href="/collections"
                  >
                    精选集合
                  </Link>
                </li>
                <li>
                  <Link prefetch={false}
                    className="inline-flex min-h-6 items-center text-sm text-foreground hover:text-gongke-accent"
                    href="/compare"
                  >
                    二选一对比
                  </Link>
                </li>
                <li>
                  <Link prefetch={false}
                    className="inline-flex min-h-6 items-center text-sm text-foreground hover:text-gongke-accent"
                    href="/privacy-policy"
                  >
                    隐私政策
                  </Link>
                </li>
              </ul>
            </div>
            {/* 原站这里是空 div（见文件顶部说明）。现在承载 AI 资讯入口，
                保留同样的 `md:w-1/2` 宽度职责，让左边那列仍然只占一半。 */}
            <div className="md:w-1/2 mb-6 md:mb-0">
              <Link prefetch={false}
                href="/news"
                className="group inline-flex items-center gap-2 rounded-lg border border-foreground/10 bg-card px-3 py-2 text-sm font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
                data-testid="news-footer-link"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gongke-accent/10 text-gongke-accent transition-colors group-hover:bg-gongke-accent/15"
                  aria-hidden="true"
                >
                  <Newspaper className="h-3.5 w-3.5" />
                </span>
                AI 资讯
                <ArrowUpRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
              <p className="mt-2.5 max-w-[18rem] text-xs leading-relaxed text-gongke-muted">
                AIHOT 精选的每日 AI 行业动态，含模型发布、产品更新、论文与观点。
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
