import { allCategories, tools } from '@/lib/data';
import { dailyArchive, hotTopics } from '@/lib/daily-data';

/**
 * 站点体量的四个数字 —— 全站唯一来源。
 *
 * **它不在 hero 里**（2026-10-27 定稿）。曾经有两个形态：`HeroStats`（墨底
 * 四栏看板，桌面端留在 hero）与 `InlineStats`（一行旁注，仅移动端）。
 * 2026-10-26 的实测审计把前者删掉了，理由不是审美，是预算：
 *
 *   七个主流视口里只有 768×1024 与 1920×1080 能看到一张完整的工具卡。
 *   390×664 / 1024×768 / 1280×800 的首卡可见高度是 **0**，1440×900 只露
 *   44/139。hero 占掉首屏 53–83%，而它内部除了四行字就是这一排数字。
 *
 * 四个数字回答的是「这站大不大」（信任背书），不是「我下一步做什么」
 * （行动引导）。它挡在了唯一该做的事前面 —— 尤其在一个导航站上，读者
 * 打开首页的目的就是「有没有我那个需求」。
 *
 * 所以现在**只有一个形态**：一行旁注，挂在「热门工具」标题行里。读者
 * 看到工具卡的同时看到体量，数字变成「证明这站很大」而不是「挡住我看工具」。
 * 桌面端也因此受益：首卡从 top 857 提到 617，1440×900 终于能在第一屏
 * 看到完整的一张卡。
 *
 * 标签必须可见（2026-10-22 的教训）：第一版把 `<dt>` 写成 `sr-only`，
 * 理由写着「读屏用户仍能听到『收录工具 2081 个』」—— 但那是把**视觉用户**
 * 排除在外了。390×844 实测页面上只剩「2081 个 26 个 180 期 10 条」，
 * 四个数字各自指什么完全读不出来，比不显示更糟：数字本身没有信息量，
 * 标签才是信息。
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

/**
 * 单行横排、12px、用「·」分隔 —— 它是**旁注**而不是看板。
 *
 * 没有断点条件：所有视口都显示（原来只有 `md:hidden` 的移动端显示）。
 * 桌面端放在「热门工具」标题行右侧，与标题同一基线。
 */
export function InlineStats() {
  return (
    <dl className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
      {homeStats().map((s) => (
        <div key={s.label} className="flex items-baseline gap-0.5">
          <dd className="tabular-nums font-medium text-foreground/80">{s.value}</dd>
          <dt className="text-2xs">
            {s.unit}
            {s.label.replace(/^(收录|此刻)/, '')}
          </dt>
        </div>
      ))}
    </dl>
  );
}
