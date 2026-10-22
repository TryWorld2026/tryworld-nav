import { ArrowUpRight, Flame, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { hotTopics, latestDaily } from '@/lib/daily-data';
import { formatDateFull, weekdayZh } from '@/lib/news-period';
import { SECTION_WIDTH_CLASS, type SectionWidth } from '@/lib/layout';

/**
 * 资讯频道五个分区共用的报头。
 *
 * 2026-10-17 重做。原来五个页面的报头是「一行小标签 + 一个标题 + 一段说明 +
 * 一行元信息」，全部白底灰字，彼此长得一模一样 —— 切标签页时除了标题文字
 * 变了，页面几乎没有任何视觉反馈，用户说的「没有设计感」在资讯频道里最明显。
 *
 * 现在改成一块**墨色报头**（与首页 hero 同一材质 `.ink-band`）：
 *   - 左侧是栏目标签、标题、说明；
 *   - 右侧是这一栏的「此刻」入口：最新日报、最热一条、分类索引。它们不是
 *     重复导航，而是把读者从「目录」直接带到「一条具体的内容」；
 *   - 底色深、字色浅，与下面的列表形成明确的版块边界 —— 滚动时一眼能看出
 *     「报头过去了，现在是内容」。
 *
 * `children` 留给各页补自己的元信息（期数、更新时间等），排在说明下方。
 */
export function NewsMasthead({
  eyebrow,
  title,
  description,
  icon,
  children,
  quickLinks = true,
  width = 'reading',
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** 栏目标签前的图标；不传时用报纸图标。 */
  icon?: React.ReactNode;
  /** 说明文字下方的附加行，各频道自己给。 */
  children?: React.ReactNode;
  /** 是否渲染右侧的「此刻」速览。日报/周报页想要更单纯的报头时可关掉。 */
  quickLinks?: boolean;
  /** 报头内层容器的宽度，**必须与下方正文、频道栏一致**（见 `lib/layout.ts`）。 */
  width?: SectionWidth;
}) {
  const daily = latestDaily();
  const hot = hotTopics[0];
  const hotCount = hotTopics.length;

  return (
    <header className="ink-band">
      {/* 墨块本身**铺满视口**（那是版块边界，必须全宽），块内内容与下方正文
          同宽 —— 报头比正文宽或窄，滚动时都会看到两套左缘。
          2026-10-18 曾把它收窄到 1088 来「修」1760 下的空档：那时正文也是
          1088，报头一旦铺开就比整页宽出 672px。现在索引页的正文改成 1760，
          报头跟着铺开，空档交给中间那道竖分隔线去交代 —— 左文右卡是报纸报头
          本来的结构，分隔线让中间的空间读起来是「留白」而不是「漏排」。 */}
      <div className={`${SECTION_WIDTH_CLASS[width]} py-9 md:py-11`}>
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-12 2xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* 左栏在 2xl 下排成报纸报头的两行：
                行 1 =「名字 | 说明」两列（中间一道竖线），
                行 2 = 元信息，横跨两列并压一道通栏细线。

              2026-10-18 试过两种更省事的写法，都失败：
                1. 说明用 CSS 双栏（`columns-2`）填空档 —— `column-count`
                   只按平衡后的列高分内容，55 字的中文段落两行全落在第一列
                   （Range 的 client rects 全是同一个 x），第二列整列空着；
                2. 标题与说明并排、说明不限宽 —— 一行 70+ 中文字，眼睛回行时
                   会串到下一行。
              现在是真正的网格：标题自成一列给出版块重量，说明固定在 41rem
              （约 43 字）的舒适行长上，剩下的宽度由**通栏元信息线**收口 ——
              那道线一直画到速览栏的竖线脚下，中间的空因此读作栏底的留白，
              而不是没排完。 */}
          <div className="min-w-0 2xl:grid 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:items-stretch 2xl:gap-x-12">
            <div className="min-w-0 2xl:col-start-1 2xl:row-start-1">
              <p className="mb-2.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#F2EEE6]/55">
                <span className="text-[#F2A07F]" aria-hidden="true">
                  {icon ?? <Newspaper className="h-3.5 w-3.5" />}
                </span>
                {eyebrow}
              </p>
              {/* 标题随版心一起放大：1760 的报头里一个 36px 的标题等于一句「注脚」，
                  读者先看到的是四边的空。宽屏下报到 56px，尺寸本身就承担了「这是
                  一张报头」的交代，而不是靠再加一块色块。 */}
              <h1 className="font-display text-[30px] leading-[1.15] tracking-[-0.01em] text-[#F2EEE6] md:text-[40px] 2xl:text-[56px]">
                {title}
              </h1>
            </div>

            {/* 说明列在 2xl 下靠底对齐，末行与标题的底线落在同一条线上。 */}
            <div className="min-w-0 2xl:col-start-2 2xl:row-start-1 2xl:flex 2xl:flex-col 2xl:justify-end 2xl:border-l 2xl:border-white/15 2xl:pl-10">
              {/* `/62` 不是默认刻度里的值（0,5,…,100），Tailwind 不产出任何
                  CSS，整条 `color` 声明消失、文本回落到继承色 —— 在墨色带上
                  就是主色，比预期深一档。要非刻度值只能用方括号写任意值。 */}
              {/* `text-balance`：这段导语在 /news 390、/news/daily 768、
                  /news/weekly 与 /news/hot 1024 下都折成三行，末行只剩
                  6–8% 宽的一两个字。均衡换行把三行拉平，墨底上不再出现
                  一条挂在左边的短尾。 */}
              <p className="mt-3 max-w-[34rem] text-balance text-[15px] leading-relaxed text-[#F2EEE6]/[0.62] 2xl:mt-0 2xl:max-w-[41rem]">
                {description}
              </p>
            </div>

            {children && (
              // 通栏细线从 lg 起就有：它把「标题 + 说明」和「期数 / 更新时间」
              // 分开，同时结束左栏 —— 线右端正好停在速览栏的竖线脚下。
              <div
                className={`mt-4 2xl:col-span-2 2xl:row-start-2 ${
                  width === 'content'
                    ? 'lg:mt-7 lg:border-t lg:border-white/15 lg:pt-4'
                    : ''
                }`}
              >
                {children}
              </div>
            )}
          </div>

          {quickLinks && (
            // 宽报头（1760）下在速览卡与标题之间立一道竖分隔线：没有它，
            // 1392px 的左栏里只有 56ch 的文字，右栏的卡会被读成「另一个
            // 区块掉在了右边」。窄报头（1088）没有这段空档，不加。
            <div
              className={`hidden min-w-0 space-y-2 lg:block ${
                width === 'content' ? 'lg:border-l lg:border-white/15 lg:pl-10' : ''
              }`}
            >
              {daily && (
                <Link prefetch={false}
                  href={`/news/daily/${daily.date}`}
                  className="group flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] active:translate-y-0"
                >
                  <Newspaper
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F2A07F]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F2EEE6]/55">
                      最新日报 · {formatDateFull(daily.date)} {weekdayZh(daily.date)}
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[13px] text-[#F2EEE6]/85 transition-colors group-hover:text-white">
                      {daily.lead?.title ?? '今日无大事发生'}
                    </span>
                  </span>
                </Link>
              )}
              {hot && (
                <Link prefetch={false}
                  href="/news/hot"
                  className="group flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] active:translate-y-0"
                >
                  <Flame
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F2A07F]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F2EEE6]/55">
                      此刻最热 · {hotCount} 条
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[13px] text-[#F2EEE6]/85 transition-colors group-hover:text-white">
                      {hot.title}
                    </span>
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * 报头里的一枚「元信息」小徽章：期间、期数、更新时间。放在墨底上，用半透明
 * 描边而不是实心底色，免得和右侧速览卡抢重量。
 */
export function MastheadMeta({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#F2EEE6]/55">
      {children}
    </div>
  );
}

/** 报头底部的出口链接（日报页的「看此刻热点」这类）。 */
export function MastheadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link prefetch={false}
      href={href}
      className="group inline-flex min-h-6 items-center gap-1 font-medium text-[#F2EEE6]/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60"
    >
      {children}
      <ArrowUpRight
        className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
