'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { CategoryIcon } from './category-icon';
import { cn, rgb, rgbAlpha } from '@/lib/utils';
import type { Category, Tag } from '@/lib/types';

/**
 * `/tools` 的四组筛选（分类 / 标签 / 价格 / 平台）。
 *
 * 为什么要有这个文件：2026-10-23 之前这里是四排**同一种灰胶囊**，分类 26 个、
 * 标签 9 个、价格 3 个、平台 18 个全铺在搜索框下面，没有分组标题、没有计数、
 * 没有层级。手机上 26 个分类折成 8 个之后还剩一张「全部分类（26）」的胶囊，
 * 390×844 的首屏里一张工具卡都露不出来 —— 这一屏是全站最不精致的地方。
 *
 * 现在的分工：
 *   - `FacetPanel` 只画四组（不含标题栏），左栏与移动端抽屉**共用同一份**，
 *     避免「桌面能筛、手机不能筛」这类两套实现漂移；
 *   - `FacetRail` 是 ≥1024px 的粘性左栏（`aside aria-label="筛选"`），
 *     由 `tools-explorer` 放进两栏网格的左侧；
 *   - <1024px 由 `filter-sheet.tsx` 把 `FacetPanel` 装进底部抽屉。
 *
 * 计数**不是**「全库有多少个」这种静态数：它由 `tools-explorer` 按 facet 口径
 * 算好传进来（每一维排除自己、其余条件不变）。命中 0 的选项降到 40% 不透明度
 * 但仍可点 —— 直接禁用会让读者以为那个分类坏了，而它其实只是被别的筛选挡掉了。
 */

export type FacetPriceOption = { value: string; label: string; count: number };
export type FacetPlatformOption = { name: string; count: number };

export type FacetPanelProps = {
  categories: Category[];
  tags: Tag[];
  catCounts: Map<string, number>;
  tagCounts: Map<string, number>;
  priceOptions: FacetPriceOption[];
  platformOptions: FacetPlatformOption[];
  selected: {
    cats: readonly string[];
    tags: readonly string[];
    price: string;
    platforms: readonly string[];
  };
  onToggleCategory: (slug: string) => void;
  onToggleTag: (name: string) => void;
  onTogglePrice: (value: string) => void;
  onTogglePlatform: (name: string) => void;
};

/**
 * 分类列表折叠时的高度上限。
 *
 * 26 个分类 × 32px = 832px，比 900 高的视口扣掉页眉（约 60px）之后剩下的
 * 还多 —— 整条左栏会被顶出屏幕，价格与平台两组直接看不到。20rem = 320px
 * 露出 10 行，底部渐隐 + 「显示全部」给出路。
 */
const CAT_LIST_MAX = 'max-h-[20rem]';

/**
 * 平台先露几个。8 行 × 32px = 256px：一屏里「分类（折叠）+ 标签 + 价格 +
 * 平台」四组的标题都能落在首屏，而不是滚到一半才看见「平台」两个字。
 */
const PLATFORM_PREVIEW = 8;

/** 分类列表折叠时显示的行数上限，与 `CAT_LIST_MAX` 是同一个量的两种写法。 */
const CAT_PREVIEW = 10;

const ROW_BASE =
  'flex w-full items-center gap-2 rounded-md px-2 text-left text-sm leading-none transition-colors duration-200 h-8 max-lg:min-h-11';

function rowClass(on: boolean, zero: boolean) {
  return cn(
    ROW_BASE,
    on
      ? // 价格/平台/标签用品牌绿；分类行另有内联的分类色（内联样式压过它）。
        'bg-gongke-accent/10 font-medium text-gongke-accent'
      : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground',
    // 0 命中不是「禁用」：仍然是按钮、仍然可点，只是视觉上退后一档。
    // 0 命中不是「禁用」，但也不能淡到读不出来：opacity-40 实测只有 1.7–1.9:1，
    // 无障碍审计会直接判不合格。改成次级文字色（约 4.9:1），仍然明显退后一档。
    zero && 'text-muted-foreground',
  );
}

function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1.5 px-2 text-xs font-semibold leading-5 text-foreground">
      {children}
    </h3>
  );
}

/** 「显示全部 / 收起」这类次级动作：桌面上 36px 足够，手机上必须 ≥44px。 */
const TOGGLE_CLASS =
  'inline-flex items-center gap-1 rounded-md px-2 text-xs text-gongke-accent transition-colors duration-200 hover:underline h-9 max-lg:min-h-11';

function Count({ n, className }: { n: number; className?: string }) {
  return (
    // 计数是「读数」而不是装饰：12px、tabular-nums，不叠 opacity —— 低对比的
    // 数字在这块面板里等于没有（对比度审计里 2.41:1 的那批就是这种写法）。
    <span className={cn('shrink-0 text-xs tabular-nums', className)}>{n}</span>
  );
}

export function FacetPanel({
  categories,
  tags,
  catCounts,
  tagCounts,
  priceOptions,
  platformOptions,
  selected,
  onToggleCategory,
  onToggleTag,
  onTogglePrice,
  onTogglePlatform,
}: FacetPanelProps) {
  /**
   * 折叠状态留在面板内部：左栏常驻、抽屉每次打开都是新实例（重新折叠）。
   * 若提到父组件，手机上「展开全部 26 个」的状态会串到下一次打开，读者会
   * 看到一个默认就很长的抽屉。
   */
  const [catsOpen, setCatsOpen] = useState(false);
  const [platsOpen, setPlatsOpen] = useState(false);

  const catListFoldable = categories.length > CAT_PREVIEW;
  const platFoldable = platformOptions.length > PLATFORM_PREVIEW;
  const visiblePlatforms = platsOpen
    ? platformOptions
    : platformOptions.slice(0, PLATFORM_PREVIEW);

  return (
    <div className="space-y-5">
      {/* 分类：单列列表（图标 + 名称 + 右侧 facet 计数）。26 项用胶囊铺开是
          四行半的墙，单列列表才能同时给出「层级」与「读数」。 */}
      <section>
        <GroupHeading>分类</GroupHeading>
        <div className="relative">
          <div
            className={cn(
              // 呼吸留 2px，读起来不糊成一片；滚动条窄，避免在 248px 里再抢 15px。
              'space-y-0.5',
              !catsOpen && catListFoldable && `${CAT_LIST_MAX} overflow-y-auto scrollbar-thin`,
            )}
          >
            {categories.map((c) => {
              const on = selected.cats.includes(c.slug);
              const n = catCounts.get(c.slug) ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggleCategory(c.slug)}
                  // 交互测试用 `button[aria-pressed]:has-text('AI视频/动画')` 定位，
                  // 可见文案必须仍是分类名原文，且必须保留 aria-pressed。
                  aria-pressed={on}
                  className={rowClass(on, n === 0)}
                  // 选中态保留分类色底，但**文字用墨色**：分类色里偏亮的几个（红 2.82:1、
                  // 黄更低）当正文色不合格。分类身份改由图标承担，保住对比度。
                  style={on ? { background: rgbAlpha(c.color, 0.12) } : undefined}
                >
                  <span className="shrink-0" style={on ? { color: rgb(c.color) } : undefined}>
                    <CategoryIcon name={c.icon} className="h-4 w-4" />
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate', on && 'font-medium text-foreground')}>
                    {c.name}
                  </span>
                  <Count n={n} className={on ? 'text-foreground/70' : 'text-muted-foreground'} />
                </button>
              );
            })}
          </div>
          {!catsOpen && catListFoldable && (
            // 底部渐隐：直接切掉半行看起来像溢出，渐隐才读作「下面还有」。
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent"
            />
          )}
        </div>
        {catListFoldable && (
          <button
            type="button"
            onClick={() => setCatsOpen((v) => !v)}
            aria-expanded={catsOpen}
            className={cn(TOGGLE_CLASS, 'mt-1')}
          >
            {catsOpen ? '收起分类' : `显示全部 ${categories.length} 个分类`}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform duration-200', catsOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        )}
      </section>

      {tags.length > 0 && (
        <section>
          <GroupHeading>标签</GroupHeading>
          <div className="flex flex-wrap gap-1.5 px-1">
            {tags.map((t) => {
              const on = selected.tags.includes(t.name);
              const n = tagCounts.get(t.name) ?? 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggleTag(t.name)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors duration-200 h-7 max-lg:min-h-11 max-lg:px-3',
                    on
                      ? 'border-gongke-accent/40 bg-gongke-accent/10 font-medium text-gongke-accent'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    // 同 rowClass：0 命中不再用 opacity-40（实测 1.7:1），改次级文字色。
                    n === 0 && 'text-muted-foreground',
                  )}
                >
                  {t.name}
                  <Count n={n} className={on ? undefined : 'text-muted-foreground'} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <GroupHeading>价格</GroupHeading>
        <div className="space-y-0.5">
          {priceOptions.map((o) => {
            const on = selected.price === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onTogglePrice(o.value)}
                aria-pressed={on}
                className={rowClass(on, o.count === 0)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    on ? 'bg-gongke-accent' : 'bg-foreground/25',
                  )}
                />
                <span className={cn('min-w-0 flex-1 truncate', on && 'text-gongke-accent')}>
                  {o.label}
                </span>
                <Count n={o.count} className={on ? 'text-gongke-accent' : 'text-muted-foreground'} />
              </button>
            );
          })}
        </div>
      </section>

      {platformOptions.length > 0 && (
        <section>
          <GroupHeading>平台</GroupHeading>
          <div className="space-y-0.5">
            {visiblePlatforms.map((o) => {
              const on = selected.platforms.includes(o.name);
              return (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => onTogglePlatform(o.name)}
                  aria-pressed={on}
                  className={rowClass(on, o.count === 0)}
                >
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  <Count n={o.count} className={on ? undefined : 'text-muted-foreground'} />
                </button>
              );
            })}
          </div>
          {platFoldable && (
            <button
              type="button"
              onClick={() => setPlatsOpen((v) => !v)}
              aria-expanded={platsOpen}
              className={cn(TOGGLE_CLASS, 'mt-1')}
            >
              {platsOpen ? '收起平台' : `更多（还有 ${platformOptions.length - PLATFORM_PREVIEW} 个）`}
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform duration-200', platsOpen && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * ≥1024px 的粘性筛选栏。
 *
 * 三个边界条件，改之前先看：
 *
 *   1. **`top` 用页眉自己量出来的 `--site-header-h`**，不是写死的 `top-20`。
 *      页眉在向下滚动时会整条收起（`--site-header-h` 置 0），写死 80px 的话
 *      左栏会悬在一条 80px 的空白下面、和右侧滚走的卡片对不上。回退值 80px
 *      覆盖水合前的那一帧。
 *   2. **`self-start`**：grid 子项默认拉伸到整行高，拉伸之后 `sticky` 没有可
 *      移动的空间 —— 表现是「粘性完全不生效」，而且不报任何错。
 *   3. **`max-h` + 内部滚动**：26 个分类展开 + 9 个标签 + 3 档价格 + 18 个平台
 *      合起来超过一屏。让左栏自己滚，比让整页为了够到「平台」而多滚 800px 好。
 *      滚动用 `overscroll-contain`：滚到底不会把滚动传给正文。
 */
export function FacetRail({
  activeCount,
  canClear,
  onClear,
  ...panel
}: FacetPanelProps & {
  activeCount: number;
  canClear: boolean;
  onClear: () => void;
}) {
  return (
    <aside
      aria-label="筛选"
      className={cn(
        // <1024 不渲染（不是视觉隐藏）：手机上同一份内容在底部抽屉里。
        'hidden lg:block lg:sticky lg:self-start',
        'lg:top-[calc(var(--site-header-h,80px)_+_1rem)]',
        'lg:max-h-[calc(100dvh-var(--site-header-h,80px)_-_2rem)]',
        'lg:overflow-y-auto lg:overscroll-contain scrollbar-thin',
        // 一条发丝线分出两栏；不铺底色 —— 纸面本身已经是「密度很低」的底，
        // 再加一层卡片色只是噪声（bg-card 与 bg-background 只差 4% 亮度）。
        'lg:border-r lg:border-border lg:pb-4 lg:pr-5',
      )}
    >
      <div className="flex items-baseline justify-between gap-2 pb-3">
        <h2 className="font-display text-sm font-semibold text-foreground">筛选</h2>
        <div className="flex items-baseline gap-2">
          {activeCount > 0 && (
            <span className="text-xs text-muted-foreground">{activeCount} 项生效</span>
          )}
          {canClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded text-xs text-gongke-accent transition-colors duration-200 hover:underline"
            >
              清除全部
            </button>
          )}
        </div>
      </div>
      <FacetPanel {...panel} />
    </aside>
  );
}
