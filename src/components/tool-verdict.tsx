import { Check, Compass, Minus, Sparkles, Wallet } from 'lucide-react';
import Link from 'next/link';
import { CATALOG_BY_SLUG, CATALOG_INDEX, DATA_EPOCH } from '@/lib/catalog-index';
import { extrasBySlug, toolBySlug } from '@/lib/data';
import { updatedLabel } from '@/lib/search';
import {
  VERDICTS,
  verdictBySlug,
  type ToolVerdict as ToolVerdictData,
} from '@/lib/tool-verdicts';

/**
 * 详情页的「怎么选」面板 —— 回答「我该不该用它」。
 *
 * 位置：hero 与「产品简介」之间。用户读完一句话定位之后，第一个问题不是
 * 「它有什么功能」，而是「适合我吗、和我在用的那个比怎么样」。
 *
 * 两种来源，同一个标题，**徽章如实区分**：
 *
 *   1. 人工条目（`lib/tool-verdicts.ts`）—— 徽章「编辑判断」。写适合/不适合/
 *      与同类差异/起价。2081 个工具里目前 363 条（17.4%）。
 *   2. 目录事实（本文件下方 `DerivedVerdict`）—— 徽章「目录事实」。**不写任何
 *      判断**，只陈述能从目录里数出来的东西：同类有多少个、其中多少免费、
 *      同类里哪些已经有编辑判断、以及收录信息是否已经过期。
 *
 * 为什么必须有第 2 种：实测（2026-10-22）`01agent` 与 `135editor-ai` 这类没有
 * 人工条目的页面，首屏 500 字直接掉进厂商自述的「产品简介」prose，而
 * `lovart-ai` 首屏就把「适合/不适合/与同类比/价格」给完。也就是说块消失不是
 * 「少一块看不出来」，而是页面**自动退化成厂商文案页** —— 比空块更糟。
 * 1718 个页面都在这条路径上（2081 − 363 条人工条目）。
 *
 * 第 2 种的底线（写代码时不要越过）：
 *   - 不写「适合/不适合」推断句。那需要人工判断，编造一条比不写更伤信任。
 *   - 不写「与 X 相比」。除非 vs 指向一个真实存在的人工条目。
 *   - 数据缺失就如实缺失，不用「暂无数据」占位。
 *   - 每一句都能被目录里的字段验证。
 */

/** 同分类的规模统计，模块级算一次（构建期只跑一遍，不进客户端）。 */
type CategoryStat = { total: number; free: number };
const CATEGORY_STATS: Map<string, CategoryStat> = (() => {
  const m = new Map<string, CategoryStat>();
  for (const r of CATALOG_INDEX) {
    const isFree = r.p === 'fully-free' || r.p === 'open-source';
    for (const c of r.c) {
      const s = m.get(c) ?? { total: 0, free: 0 };
      s.total += 1;
      if (isFree) s.free += 1;
      m.set(c, s);
    }
  }
  return m;
})();

/**
 * 每个分类下**已有人工判断**的 slug，按目录顺序。
 *
 * 这是降级块最重要的一句话：把读者从「这个工具我没把握」引导到「同分类里
 * 这几个我写过判断」。否则 363 条人工内容在 2081 个页面里等于不存在 ——
 * 只有从分类页或搜索点进去才会碰到它们。
 */
const JUDGED_BY_CATEGORY: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const r of CATALOG_INDEX) {
    if (!VERDICTS[r.s]) continue;
    for (const c of r.c) {
      const list = m.get(c) ?? [];
      list.push(r.s);
      m.set(c, list);
    }
  }
  return m;
})();

/**
 * 稳定但分散的起始下标。
 *
 * 若永远取前 3 个，那么「AI图像/设计」的 336 个页面会全部推荐同样 3 个工具，
 * 363 条人工判断里其余 360 条在降级块里等于不存在。按 slug 哈希错开起点，
 * 让同类页面各自看到不同的三个 —— 同一页每次构建结果仍然完全一致（纯静态
 * 导出要求字节稳定，见 `catalog-index.ts` 的 `DATA_EPOCH` 说明）。
 */
function rotateStart(slug: string, length: number): number {
  if (length <= 3) return 0;
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) % 100000;
  return h % length;
}

/** 超过这个天数就把「收录信息已过期」明说出来。 */
const STALE_DAYS = 365;

export function ToolVerdict({ slug }: { slug: string }) {
  const verdict = verdictBySlug(slug);
  return verdict ? (
    <ManualVerdict verdict={verdict} />
  ) : (
    <DerivedVerdict slug={slug} />
  );
}

function ManualVerdict({ verdict }: { verdict: ToolVerdictData }) {
  const vsTool = verdict.vs ? toolBySlug.get(verdict.vs) : undefined;
  const price = verdict.price;
  const hasPrice = Boolean(price?.freeTier || (price?.from ?? 0) > 0);

  return (
    <section
      className="rounded-2xl border border-foreground/10 bg-card p-5 md:p-6"
      aria-labelledby="verdict-heading"
    >
      <h2
        id="verdict-heading"
        className="flex items-center gap-2 text-[15px] font-semibold text-foreground"
      >
        <Sparkles className="h-4 w-4 text-gongke-accent" aria-hidden="true" />
        怎么选
        <span className="ml-1 rounded-full bg-gongke-accent/10 px-2 py-0.5 text-[11px] font-medium text-gongke-accent">
          编辑判断
        </span>
      </h2>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
            <Check className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
            适合
          </h3>
          <ul className="mt-2 space-y-1.5">
            {verdict.bestFor.map((s) => (
              <li key={s} className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/80">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gongke-accent" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        {verdict.notFor && verdict.notFor.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
              <Minus className="h-3.5 w-3.5 text-[#B54826]" aria-hidden="true" />
              不适合
            </h3>
            <ul className="mt-2 space-y-1.5">
              {verdict.notFor.map((s) => (
                <li key={s} className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/80">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#B54826]/70" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {verdict.diff && (
        <div className="mt-5 rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] p-3.5">
          <p className="text-[13px] leading-relaxed text-foreground/80">
            <span className="font-medium text-foreground">与同类比：</span>
            {verdict.diff}
            {vsTool && (
              <>
                {' '}
                <Link
                  href={`/tools/${vsTool.slug}`}
                  className="text-gongke-accent underline decoration-gongke-accent/30 underline-offset-2 hover:decoration-gongke-accent"
                >
                  看看 {vsTool.name}
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {hasPrice && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-gongke-muted">
          <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          {price?.freeTier && <span>{price.freeTier}</span>}
          {typeof price?.from === 'number' && price.from > 0 && (
            <span>
              起价 {price.currency === 'USD' ? '$' : '¥'}
              {price.from}
              {price.period ? ` / ${price.period}` : ''}
            </span>
          )}
          {price?.checkedAt && <span>· 核对于 {price.checkedAt}</span>}
        </p>
      )}

      <p className="mt-3 text-[11.5px] text-muted-foreground">
        以上为编辑判断，价格以官网为准。发现信息有误可在「关于我们」页找到反馈方式。
      </p>
    </section>
  );
}

/**
 * 没有人工资 judgement 时的降级块。**只陈述目录事实。**
 *
 * 三件事按「对决定影响从大到小」排：
 *   1. 同类规模与免费占比 → 告诉读者「你不是只有这一个选择」，并给出带着
 *      分类筛选的出口（`/tools?cat=…`），而不是让人退回去重新找。
 *   2. 同类里已有人工判断的工具 → 把 363 条编辑判断送到 1718 个降级页面上。
 *   3. 收录信息过期提示 → 审计实测 `updated` 中位 371 天、88.75% 超一年，
 *      页面却把「更新于 2025年10月11日」当新鲜度徽章展示。这里是唯一一处
 *      可以如实说明「这个快照老了」的地方。
 *
 * 返回 null 的条件：拿不到工具、没有分类、且也没有过期提示 —— 宁可整块不渲染，
 * 也不给一个只有标题的空盒。
 */
function DerivedVerdict({ slug }: { slug: string }) {
  const tool = toolBySlug.get(slug);
  if (!tool) return null;

  const extras = extrasBySlug(slug);
  const rec = CATALOG_BY_SLUG.get(slug);
  const primary = tool.categories[0];

  const stat = primary ? CATEGORY_STATS.get(primary.slug) : undefined;
  const peers =
    primary && stat && stat.total > 1
      ? stat.total - 1
      : 0;
  const freePeers = primary && stat ? stat.free - (isFreeRecord(rec) ? 1 : 0) : 0;

  // 同类里已有人工判断的（排除自己），按 slug 哈希错开起点取 3 个 ——
  // 见 `rotateStart` 上方的说明。
  const judgedAll = (primary ? (JUDGED_BY_CATEGORY.get(primary.slug) ?? []) : []).filter(
    (s) => s !== slug,
  );
  const start = rotateStart(slug, judgedAll.length);
  const judged = [...judgedAll.slice(start), ...judgedAll.slice(0, start)].slice(0, 3);

  // 收录信息是否过期。参照点用 `DATA_EPOCH`（目录里最新的 updated）而不是
  // `Date.now()` —— 纯静态导出要求「没改内容就一个字节不变」，渲染期读当前
  // 时间会让 2081 个页面每天全量重传（见 catalog-index.ts 的说明）。
  const ageDays =
    DATA_EPOCH !== undefined && typeof rec?.u === 'number' ? DATA_EPOCH - rec.u : undefined;
  const stale = typeof ageDays === 'number' && ageDays > STALE_DAYS;
  const staleDate = stale && typeof rec?.u === 'number' ? updatedLabel(rec.u) : '';

  if (peers === 0 && !stale) return null;

  return (
    <section
      className="rounded-2xl border border-foreground/10 bg-card p-5 md:p-6"
      aria-labelledby="verdict-heading"
    >
      <h2
        id="verdict-heading"
        className="flex items-center gap-2 text-[15px] font-semibold text-foreground"
      >
        <Compass className="h-4 w-4 text-gongke-accent" aria-hidden="true" />
        怎么选
        <span className="ml-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-medium text-foreground/60">
          目录事实
        </span>
      </h2>

      {/* 文案刻意**不写「我们写了 N 个工具的判断」**。
          2026-10-22 实测缺陷：这里曾经硬编码「197 个工具」，而人工条目扩到
          363 条之后，1718 个降级页仍在向读者说「197」—— 和 `/news` 那个
          「顶部 70 个来源、页脚 10 个来源」是同一类问题：页面上写的数字与
          实际不符，而且只在降级页里出现，抽查人工条目页是看不到的。
          改成动态数字也不做：读者关心的是「这个工具有没有」，不是「你们
          做了多少个」；而动态数字每加一条都要重新构建才能对。 */}
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        这个工具还没有编辑判断。下面是可以从目录里直接数出来的事实，供你判断要不要花时间。
      </p>

      {peers > 0 && primary && (
        <div className="mt-4 rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] p-3.5">
          <p className="text-[13px] leading-relaxed text-foreground/80">
            <span className="font-medium text-foreground">同类还有：</span>
            「{primary.name}」下另有 {peers} 个工具
            {freePeers > 0 ? (
              <>
                ，其中 <span className="font-medium text-foreground">{freePeers} 个</span>
                完全免费或开源
              </>
            ) : (
              '，都不提供免费版本'
            )}
            。{' '}
            <Link
              href={`/tools?cat=${primary.slug}`}
              className="text-gongke-accent underline decoration-gongke-accent/30 underline-offset-2 hover:decoration-gongke-accent"
            >
              按这个场景比较
            </Link>
            {freePeers > 0 && (
              <>
                {' '}
                <Link
                  href={`/tools?cat=${primary.slug}&price=free`}
                  className="text-gongke-accent underline decoration-gongke-accent/30 underline-offset-2 hover:decoration-gongke-accent"
                >
                  只看免费的 {freePeers} 个
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {judged.length > 0 && (
        <div className="mt-3">
          <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
            <Check className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
            同类里已有编辑判断的
          </h3>
          <ul className="mt-2 space-y-1.5">
            {judged.map((s) => {
              const peer = toolBySlug.get(s);
              const v = VERDICTS[s];
              const first = v?.bestFor?.[0];
              if (!peer) return null;
              return (
                <li key={s} className="flex gap-2 text-[13.5px] leading-relaxed">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gongke-accent" />
                  <span className="min-w-0">
                    <Link
                      href={`/tools/${s}`}
                      className="font-medium text-foreground hover:text-gongke-accent hover:underline"
                    >
                      {peer.name}
                    </Link>
                    {first && (
                      <span className="text-muted-foreground"> —— 适合：{first}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {stale && (
        <p className="mt-4 flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
          <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B54826]" aria-hidden="true" />
          <span>
            站内对这个工具的收录快照停在 <time dateTime={staleDate}>{staleDate}</time>
            ，已超过一年。价格、功能与支持平台都可能已经变了，请以官网为准。
          </span>
        </p>
      )}

      <p className="mt-3 text-[11.5px] text-muted-foreground">
        以上为目录统计，不含编辑推荐。想让我们补上这个工具的判断，可在「关于我们」页找到反馈方式。
      </p>
    </section>
  );
}

/** 这条目录记录是否属于「完全免费 / 开源」两档 —— 与 `filterRecords` 的
 *  `price=free` 口径一致（238 条）。用来在统计同类时把自己那一份扣掉。 */
function isFreeRecord(rec: { p: string } | undefined): boolean {
  return rec?.p === 'fully-free' || rec?.p === 'open-source';
}
