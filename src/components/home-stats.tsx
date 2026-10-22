import { allCategories, tools } from '@/lib/data';
import { dailyArchive, hotTopics } from '@/lib/daily-data';

/**
 * 站点体量的四个数字 —— 全站唯一来源。
 *
 * 为什么抽成组件：这四个数字原来只住在 `hero.tsx` 里，而 2026-10-22 实测
 * 移动端（390×844）首屏被它整块吃掉 —— hero 内 6 个纵向块（定义句 → H1 →
 * 搜索框 → 两个 CTA → stats），stats 在 top 516、hero 到 685 结束，中间
 * 119px 是纯留白，而**第一张工具卡落在 top 773**（屏高 844，只露 71px）。
 *
 * 也就是说手机用户打开首页，看到的是「一句话 + 一个搜索框 + 四个数字」，
 * 一张工具卡都看不全。而这四个数字回答的是「这站大不大」（信任背书），
 * 不是「我下一步做什么」（行动引导）—— 它挡在了唯一该做的事前面。
 *
 * 处理：**移动端搬走，桌面端留在 hero**。搬到的位置是「热门工具」区块的
 * 标题行右侧 —— 那里读者已经看到工具卡了，数字变成「证明这站很大」而不是
 * 「挡住我看工具」。桌面端（≥768）首屏够高，留在 hero 作为落地基线。
 *
 * 两种渲染形态共用同一份数据与同一套措辞，避免两处各写一遍然后漂移。
 */

/** 四个统计项。顺序固定：先「有多少工具」，再「分几类」，然后「有内容」，最后「有热点」。 */
export function homeStats(): { value: number; label: string; unit: string }[] {
  return [
    { value: tools.length, label: '收录工具', unit: '个' },
    { value: allCategories.length, label: '分类', unit: '个' },
    { value: dailyArchive.length, label: '日报', unit: '期' },
    { value: hotTopics.length, label: '此刻热点', unit: '条' },
  ];
}

/** 墨底版本（hero 内，桌面端）。四个数字横跨全宽，左缘与站名对齐。 */
export function HeroStats() {
  return (
    <dl className="mt-10 hidden grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-4 md:grid lg:mt-12">
      {homeStats().map((s) => (
        <div key={s.label}>
          <dt className="text-[11px] tracking-wide text-[#F2EEE6]/60">{s.label}</dt>
          <dd className="mt-0.5 font-display text-2xl tabular-nums text-[#F2EEE6]">
            {s.value}
            <span className="ml-1 text-sm text-[#F2EEE6]/55">{s.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 纸面版本（「热门工具」标题行右侧，仅移动端）。
 *
 * 单行横排、字号压到 12px、用「·」分隔 —— 它现在是一个**旁注**而不是看板。
 * 用 `<dl>` 保持语义（读屏用户仍能听到「收录工具 2081 个」）。
 */
export function InlineStats() {
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground md:hidden">
      {homeStats().map((s) => (
        <div key={s.label} className="flex items-baseline gap-1">
          <dt className="sr-only">{s.label}</dt>
          <dd className="tabular-nums">
            <span className="font-medium text-foreground/80">{s.value}</span>
            <span className="ml-0.5 text-[11px]">{s.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
