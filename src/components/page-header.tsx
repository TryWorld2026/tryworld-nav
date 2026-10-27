/**
 * 列表页的页头。与首页 hero 共用同一套「栏目标签 → 标题 → 描述」的层级，
 * 只是小一号、且不铺墨底 —— 列表页的工具本身才是主角，页头不该压过它们。
 *
 * 2026-10-17 调整：标题从 24/30px 提到 30/36px 的 `font-display`，与下方
 * 内容的 15/13px 拉开两档。
 *
 * 2026-10-18：≥1800（`4xl`）改成两栏刊头 —— 标签与标题在左，描述贴右栏
 * 底端。原先在 2560 上整个页头只有左边 700px 有字，右边约 1295px 一片
 * 空白，紧接着下方却是铺满全宽的筛选器与工具网格：「页头塌、内容满」的
 * 落差是宽屏上最刺眼的一处。描述移到右栏后，页头的左右缘与下方内容对齐成
 * 一整块，标题与描述之间的大块留白变成**刻意的版式留白**（左题右记的刊头
 * 结构），而不是「右边忘了放东西」。
 * 1440/1536 上两栏会把标题和描述各挤进 700/550，比单栏更碎，所以断点放在
 * 1800 而不是 `2xl`。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  /** 标题上方的小标签，与各频道页的 `AIHOT · …` 是同一规格。 */
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-foreground/10 pb-6">
      <div
        className={
          description
            ? 'grid grid-cols-1 gap-3 4xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] 4xl:items-end 4xl:gap-16'
            : undefined
        }
      >
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl 4xl:text-6xl 4xl:leading-tight">
            {title}
          </h1>
        </div>
        {description && (
          // 66ch 而不是 62ch：单栏时（< 1800）现有几条描述正好能在 66ch 内
          // 收进一行，62ch 会多折一次。
          // 两栏时右栏固定 32rem（512px）就窄于 66ch，这一档自然失效 ——
          // 于是「共收录 2081 个…按分类、标签或关键词筛选。」在 1920/2560
          // 上稳定断在「关键词筛 / 选。」：末行只剩两个字，是典型的孤行。
          // `text-balance` 让两行长度接近（约 20/20），孤行消失；它只在
          // 折成 2 行时生效，一行或单栏时是无操作。
          <p className="mt-2.5 max-w-[66ch] text-balance text-base leading-relaxed text-gongke-muted 4xl:mt-0">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
