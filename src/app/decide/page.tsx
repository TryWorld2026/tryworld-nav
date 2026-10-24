import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { DecideFlow } from '@/components/decide-flow';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';
import { VERDICT_COUNT } from '@/lib/verdict-index';

/**
 * `/decide`（帮我选）—— 本站唯一的「决策页」。
 *
 * 为什么它值得一个一级入口：2081 条目录本身没有壁垒（任何站都能扒同一份名单，
 * 事实上本站的目录就是从别处采来的），真正独有且抄不走的是 363 条人工写下的
 * 「适合 / **不适合** / 与同类差在哪 / 起价 / 核对于」。但在这一页之前，这些
 * 判断只能从某一个工具详情页偶遇 —— 用户没有一条「我现在就要做决定」的入口，
 * 页面上也从来没有出现过「筛掉」这个动作。
 *
 * 这里的取舍（有意的）：
 *   - **只从 363 条有判断的工具里推荐**。2081 个里其余 1718 个没有人工结论，
 *     把它们混进推荐等于用目录顺序冒充判断；
 *   - **没有任务就不推荐**，宁可先让读者点一个场景，也不先塞一堆热门工具；
 *   - 判断、价格、平台、排位四类依据全部**可追溯**，页面上不出现任何分数或
 *     「AI 推荐」的说法。
 *
 * SEO：`?task=video` 这类查询串是同一页的不同条件，canonical 指向 `/decide`
 * 本身（不按条件分叉出 URL，否则 16×3×6×4 种组合会被当成 1000 多个重复页）。
 */
export const metadata: Metadata = withOg(
  {
    ...canonical('/decide'),
    title: '帮我选 — 三个问题，从 363 条人工判断里缩到 3 个',
    description:
      '告诉试界导航你想做什么、预算和平台，我们从人工写过判断的 AI 工具里筛出 3 个，并写清楚为什么是它们、为什么不推荐另外几个。不卖排名，每条判断都标着核对日期。',
    keywords: ['AI 工具怎么选', 'AI 工具推荐', 'AI 工具对比', 'AI 选型', 'AI 工具导航'],
  },
  '/decide',
);

export default function DecidePage() {
  return (
    <div className="content-container py-8 md:py-10">
      <PageHeader
        eyebrow="决策台 · 帮我选"
        title="帮我选"
        description={`三个问题：想做什么、预算、在什么设备上用。我们从人工写过判断的 ${VERDICT_COUNT} 个工具里筛出 3 个 —— 连同「不适合谁」一起给你。`}
      />

      <div className="mt-7">
        <DecideFlow />
      </div>
    </div>
  );
}
