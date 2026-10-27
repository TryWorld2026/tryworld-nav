/**
 * 「本期栏目 / 本期版面」索引 —— 期报大卡右侧那条书脊。
 *
 * 为什么需要它：周报 / 月报 / 日报的最新一期卡片铺满 1760 之后，标题与导语
 * 合计只有六百多像素，而卡片有一千三百像素宽 —— 右半张卡是空的，读起来像
 * 「标题掉进了一块黑板」。补一条真实的目录进去，卡片才像一期的封面：
 * 左边是这一期讲了什么，右边是它分成哪几栏、每栏几条，底下是体量账目。
 *
 * 2026-10-18 试过两种不成立的写法：
 *   1. 目录钉在卡片最右缘、只做左文右栏 —— 左栏文字封顶 600px，目录在
 *      1700px 处，中间空出 600px 死区，只是把空白挪了个位置；
 *   2. 改成横贯整宽的「栏目条」（`01 模型发布/更新 4  02 产品…`）—— 五个
 *      栏目只占 430px，剩下 1100px 的横线后面什么都没有，像一句排了一半的
 *      说明。
 * 现在的解法是**竖着用**：目录与四个体量数字叠在同一根书脊里，书脊占 19–21rem，
 * 内容撑满卡片的高度；左栏的文字只占卡片的上半，下半由书脊的账目接管。
 * 宽度和高度都被用上了，卡片才站得住。
 *
 * 数据全部来自已有的 `sections`，不加字段、不需要新抓取。
 * 只负责排版，颜色沿用 `.ink-band` 的浅色字阶（45/55/75）—— 2026-10-18
 * 把原来的 30/40 提了两档：墨底上 11px 的 30% 只有 2.4:1，序号和「N 条」
 * 在 1440 的截图里直接消失，书脊看起来像断了半截。
 */
export function IssueContents({
  sections,
  label = '本期栏目',
  extra = [],
}: {
  sections: { label: string; items: unknown[] }[];
  /** 日报用「本期版面」，周报/月报用「本期栏目」。 */
  label?: string;
  /** 版面之外的补充计数（日报的快讯不占版面，但该被看见）。 */
  extra?: { label: string; count: number }[];
}) {
  if (!sections.length && !extra.length) return null;
  return (
    <div className="min-w-0">
      <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-gongke-paper/55">
        {label}
      </p>
      <ol className="mt-3 space-y-2">
        {sections.map((s, i) => (
          <li key={s.label} className="flex items-baseline gap-2.5 text-sm">
            {/* 序号是正文，不是装饰：`/45` 在墨底上 3.90:1，低于 AA 的 4.5。
                升到 `/60`（5.80:1）仍然比栏目名（`/75`）淡一档，层级不变。 */}
            <span className="w-4 shrink-0 tabular-nums text-2xs text-gongke-paper/60">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1 truncate text-gongke-paper/75">{s.label}</span>
            <span className="shrink-0 tabular-nums text-2xs text-gongke-paper/55">
              {s.items.length} 条
            </span>
          </li>
        ))}
        {extra.map((e) => (
          <li key={e.label} className="flex items-baseline gap-2.5 text-sm">
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-gongke-paper/55">{e.label}</span>
            <span className="shrink-0 tabular-nums text-2xs text-gongke-paper/55">
              {e.count} 条
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 「本期还讲了」—— 封面要目。
 *
 * 书脊解决了卡片**右半**的空，左栏仍然只有标题与导语，宽屏下文字止于
 * 卡片中线，书脊之前还空着六百多像素（2560 实测：导语右缘 x≈950，书脊
 * 起于 x≈1470）。杂志封面本来就有 cover lines：主标题之外再列三五行
 * 本期内容，读者的手指之所以肯往下划，靠的就是它们。
 *
 * 这里取各栏目按重要度排序后的前四条，两列铺满左栏 —— 于是文字一直
 * 延伸到书脊的竖线，两块之间不再有死区；顺带让「今天/这周还有什么」
 * 在点进去之前就能看见。只排标题，来源留给正文页，避免小字堆叠。
 */
export function IssueCoverlines({
  items,
  label = '本期还讲了',
  limit = 4,
}: {
  items: { title: string }[];
  label?: string;
  limit?: number;
}) {
  const list = items.slice(0, limit);
  if (!list.length) return null;
  return (
    <div className="mt-6 min-w-0 border-t border-white/10 pt-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-gongke-paper/55">
        {label}
      </p>
      <ul className="mt-2.5 grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
        {list.map((it, i) => (
          <li key={i} className="flex min-w-0 items-baseline gap-2 text-sm">
            {/* 这个破折号是纯装饰（`aria-hidden`），但 `/35` 在墨底上只有
                2.92:1，读起来是一条断掉的灰点。升到 `/50`（4.48:1）仍然
                比正文淡一档，却不再像是渲染失败。 */}
            <span aria-hidden="true" className="shrink-0 text-gongke-paper/50">
              —
            </span>
            <span className="min-w-0 flex-1 truncate text-gongke-paper/65">{it.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
