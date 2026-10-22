'use client';

import { useMemo, useState } from 'react';
import { TOOL_GRID, ToolMiniCard } from './tool-card';
import { Button } from './ui/button';
import { sortCards, type CardTool } from '@/lib/card';

/**
 * 分类页的工具网格 —— 排序 + 加载更多。
 *
 * 为什么分类页需要这两个控件，而 `/tools` 需要全套筛选器：
 *
 * 两个页面的用户状态不同。`/tools` 的读者还在「找哪个场景」；分类页的读者
 * **已经选定了场景**，现在要在这个场景里挑。所以分类页比 `/tools` 更需要
 * 排序 —— 给它 173 条纯目录序，等于让它从头读到尾。实测
 * `/categories/ai-writing` 一次铺 173 张卡、DOM 1724 节点、移动端页高
 * 33,663px，无排序无分页无输入框。
 *
 * **但刻意不加筛选器**（价格/平台/搜索框都不加）：那会让分类页变成
 * `/tools?cat=` 的第二个实现，两个页面永远会漂移，维护成本翻倍。继续筛
 * 仍然走页头那条「在工具目录中筛选」链接 —— 那里有完整筛选与可分享 URL。
 *
 * 为什么排序只有「默认 / 最近更新 / 按名称」三档而没有「按相关度」：
 * 分类页没有查询词，没有「相关度」可言。默认就是目录序（原站手调顺序）。
 *
 * 为什么「加载更多」而不是分页器：卡片是扫读对象，翻页会打断滚动；
 * `/tools` 与 `/news` 都已经用「加载更多」，同一站内保持一致。
 */

const PAGE = 60;
/** 累计上限。与 `/tools` 同一条理由：全铺会把页面撑到几万节点。 */
const HARD_CAP = 480;

const SORTS = [
  { value: '', label: '默认' },
  { value: 'updated', label: '最近更新' },
  { value: 'name', label: '按名称' },
] as const;

type SortKey = (typeof SORTS)[number]['value'];

export function CategoryGrid({
  cards,
  categorySlug,
}: {
  /** 已由服务端过 `cardFromTool()` 的卡片数据，顺序 = 目录顺序。 */
  cards: CardTool[];
  /** 传进卡片用于滤掉「你已经在哪」那条分类 chip。 */
  categorySlug: string;
}) {
  const [sort, setSort] = useState<SortKey>('');
  const [limit, setLimit] = useState(PAGE);

  const sorted = useMemo(() => sortCards(cards, sort), [cards, sort]);
  const visible = sorted.slice(0, Math.min(limit, HARD_CAP));

  return (
    <div className="space-y-6">
      {/* 排序行贴在网格上方，与 `/tools` 的排序控件同一套措辞与位置感。 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 pb-3">
        <p className="text-sm text-muted-foreground">
          共 <span className="font-medium text-foreground">{cards.length}</span> 个工具
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">排序</span>
          {SORTS.map((s) => (
            <button
              key={s.value || 'default'}
              type="button"
              onClick={() => {
                setSort(s.value);
                setLimit(PAGE);
              }}
              aria-pressed={sort === s.value}
              className={
                sort === s.value
                  ? 'rounded px-1.5 py-0.5 text-xs font-medium text-foreground'
                  : 'rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground'
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={TOOL_GRID}>
        {visible.map((c) => (
          <div
            key={c.slug}
            // 与 `/tools` 同一条长列表渲染优化。
            className="[contain-intrinsic-size:auto_104px] [content-visibility:auto]"
          >
            <ToolMiniCard tool={c} hideCategorySlug={categorySlug} />
          </div>
        ))}
      </div>

      {sorted.length > visible.length && (
        <div className="flex flex-col items-center gap-2 pt-2">
          {limit < HARD_CAP ? (
            <Button
              variant="outline"
              onClick={() => setLimit((l) => Math.min(HARD_CAP, l + PAGE))}
              className="border-border text-foreground/80"
            >
              加载更多（还有 {Math.min(sorted.length, HARD_CAP) - visible.length} 个）
            </Button>
          ) : (
            <p className="max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
              已显示前 {visible.length} 个（共 {sorted.length} 个）。想在这个场景里继续筛，
              用页头的「在工具目录中筛选」—— 那里能按价格、平台收窄，链接也可以分享。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
