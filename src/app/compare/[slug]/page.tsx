import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Minus, Scale, Sparkles, Wallet } from 'lucide-react';
import { notFound } from 'next/navigation';

import { CategoryIcon } from '@/components/category-icon';
import { PageHeader } from '@/components/page-header';
import { TOOL_GRID, ToolMiniCard, iconSrcSet } from '@/components/tool-card';
import { cardFromTool } from '@/lib/card-server';
import { allComparePairs, comparePairBySlug } from '@/lib/compare-server';
import { VERDICTS, type ToolVerdict } from '@/lib/tool-verdicts';
import { extrasBySlug, relatedTools, toolBySlug, SITE } from '@/lib/data';
import { priceCodeFromLabel, priceShortLabel } from '@/lib/pricing';
import { updatedLabel } from '@/lib/search';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

/**
 * 二选一对比页 `/compare/[slug]`。
 *
 * 为什么要有这个页面：审计的核心结论是「能找到工具，但选不出工具」。详情页
 * 的「怎么选」回答了「这个工具适合我吗」，但读者真正卡住的地方是
 * **「这两个我该选哪个」** —— 那需要并排看，而不是读完 A 页再读 B 页、靠
 * 记忆比对。竞品里唯一正面解决这件事的形态就是预置对比。
 *
 * ## 三层结构：事实是骨架，判断是加层
 *
 * 实测填充率（全 2081 条）：`updated` 100% / `categories` 100% /
 * `price` 97.4% / `platforms` 72.7%；人工判断只有 17.4%。
 *
 * 所以页面**不能**做成「两块编辑判断并排」—— 那只有 176 对能看。正确顺序：
 *
 *   1. **事实对照表**（任何一对都能渲染，100% 有数据）
 *   2. **差异高亮**（只标「两边不同」的行 —— 读者要的是「差在哪」，
 *      不是「各自是什么」。这是 compare 页真正的价值）
 *   3. **编辑判断并排**（有则并排；单边有则单边 + 另一边如实说没有；
 *      都没有则整块不渲染 —— 与详情页 `ToolVerdict` 同一条纪律）
 *
 * 清单口径见 `lib/compare.ts` 文件头（用「读者关心度」而不是原站推荐）。
 */

export function generateStaticParams() {
  return allComparePairs().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pair = comparePairBySlug(slug);
  if (!pair) return { title: '对比未找到' };

  const a = toolBySlug.get(pair.a);
  const b = toolBySlug.get(pair.b);
  if (!a || !b) return { title: '对比未找到' };

  return withOg(
    {
      ...canonical(`/compare/${slug}`),
      title: { absolute: `${a.name} 还是 ${b.name}？怎么选 - ${SITE.name}` },
      description: `${a.name} 与 ${b.name} 的并排对比：价格、平台、分类、更新时间的事实对照，以及编辑对「适合谁 / 不适合谁」的判断。`,
      keywords: [
        `${a.name} ${b.name} 对比`,
        `${a.name} 和 ${b.name} 哪个好`,
        `${a.name} 替代`,
        `${b.name} 替代`,
      ],
    },
    `/compare/${slug}`,
  );
}

/** `'2026-08-22 06:17:19.986Z'` → Unix 日序。与 `card-server.ts` 同一套清洗。 */
function dayOf(raw: string): number {
  const ms = Date.parse(raw.replace(' ', 'T'));
  return Number.isNaN(ms) ? NaN : Math.floor(ms / 86_400_000);
}

type FactRow = {
  label: string;
  a: string;
  b: string;
  /** 两边是否真的不同 —— 只有不同的行才进「差异高亮」。 */
  differs: boolean;
};

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pair = comparePairBySlug(slug);
  if (!pair) notFound();

  const toolA = toolBySlug.get(pair.a);
  const toolB = toolBySlug.get(pair.b);
  if (!toolA || !toolB) notFound();

  const va = VERDICTS[pair.a];
  const vb = VERDICTS[pair.b];

  // 结构化事实 —— 全部来自采集数据，缺失如实显示「—」，不推测。
  const exA = extrasBySlug(pair.a);
  const exB = extrasBySlug(pair.b);
  const priceA = priceShortLabel(priceCodeFromLabel(exA?.pricing));
  const priceB = priceShortLabel(priceCodeFromLabel(exB?.pricing));
  const platNamesA = (exA?.platforms ?? []).map((p) => p.name);
  const platNamesB = (exB?.platforms ?? []).map((p) => p.name);
  const catNamesA = toolA.categories.map((c) => c.name);
  const catNamesB = toolB.categories.map((c) => c.name);
  const updA = exA?.updated ? updatedLabel(dayOf(exA.updated)) || '—' : '—';
  const updB = exB?.updated ? updatedLabel(dayOf(exB.updated)) || '—' : '—';

  /*
   * 多值字段的「是否不同」必须按**集合**比，不能按有序数组比。
   *
   * 2026-10-22 实测：`Cherry Studio` 的分类是「AI聊天助手、AI智能体」，
   * `Flowith` 是「AI智能体、AI聊天助手」—— **集合完全相同，只是主分类
   * （数组第一位）不同**。按有序数组比会被标成「所属分类不同」，而读者
   * 读到的意思是「这两个不属于同一类」，实际是「同一组分类、主归属不同」。
   *
   * 这与「一边有值一边是 —」是同一类错误：**把「表述不同」渲染成「事实
   * 不同」**。多值字段（分类、平台）的顺序不承载语义，所以比较前先排序。
   */
  const sameSet = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  };

  const facts: FactRow[] = [
    {
      label: '价格档',
      a: priceA || '—',
      b: priceB || '—',
      differs: (priceA || '—') !== (priceB || '—'),
    },
    {
      label: '支持平台',
      a: platNamesA.join('、') || '—',
      b: platNamesB.join('、') || '—',
      // 平台同理：顺序不承载语义，按集合比。
      differs: !sameSet(platNamesA, platNamesB),
    },
    {
      label: '所属分类',
      a: catNamesA.join('、') || '—',
      b: catNamesB.join('、') || '—',
      differs: !sameSet(catNamesA, catNamesB),
    },
    {
      label: '收录更新',
      a: updA,
      b: updB,
      differs: updA !== updB,
    },
  ];
  /*
   * 「差异高亮」只收**两边都有值且真的不同**的行。
   *
   * 三条排除规则，每条都有实测依据：
   *
   *   1. **两边都是 `—`** → 不算差异。那是两边都缺数据，标成差异会让读者
   *      以为这里有信息。
   *   2. **只有一边是 `—`** → 也不算差异（2026-10-22 补的规则）。原来的
   *      判断只看 `a !== b`，于是「豆包 免费 / 豆包手机助手 —」会被标成
   *      「价格档不同」—— 而读者读到的是「一个免费一个收费」，**真实情况
   *      是「一边没采集到」**。把缺数据渲染成事实差异，是这一页最容易
   *      误导人的地方。
   *   3. 两边都有值且不同 → 这才是真正的差异。
   *
   * 缺数据的情况由事实表自己承担：那一格显示 `—`，并且下方有一句
   * 「缺失项如实显示为「—」而不做推测」。
   */
  const diffs = facts.filter((r) => r.differs && r.a !== '—' && r.b !== '—');

  /*
   * 开头那句说明必须跟着 `diffs` 走 —— **不能无条件承诺「先看事实差异」**。
   *
   * 2026-10-22 实测：294 页里约 20 页两个工具在价格、平台、分类、更新上
   * **真的没有任何可数差异**（`a0-dev-vs-orchids`、`chatgpt-vs-claude-ai`、
   * `baigua-mianshi-vs-interview-coder` …）。那些页面的「差在哪」整节不渲染，
   * 而开头仍然写着「先看事实差异」—— 读者往下找不到那一节，会以为页面没
   * 加载完，或者以为我们漏了。
   *
   * 这与 `/news` 的「顶部 70 个来源、页脚 10 个来源」、集合页的「每个集合
   * 六个代表工具」是**同一族缺陷**：页面上说了，但实际没有。而这一族最容易
   * 漏，因为它不在数据里、在文案里 —— `npm test` 能测 `diffs` 算得对不对，
   * 测不到「开头那句话还对不对」。
   *
   * 修法是**两个方向都做**：
   *   1. 开头说明按 `diffs.length` 切换措辞（不再无条件承诺）；
   *   2. `diffs.length === 0` 时仍渲染那一节，内容是「没有可数的差异」——
   *      把「无差异」变成一个**明确的事实陈述**，而不是一片空白。
   *      因为「这两个几乎一样」本身就是有价值的信息。
   */
  const hasDiffs = diffs.length > 0;

  // 其他对比：优先给「同分类里其它预置对比」，给「这组不够、我还想看别的」出口。
  const siblings = allComparePairs()
    .filter((p) => p.slug !== slug)
    .slice(0, 6);

  return (
    <div className="content-container py-8 md:py-10">
      <div className="mb-6">
        <Link prefetch={false}
          href="/compare"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          全部对比
        </Link>
      </div>

      <PageHeader
        eyebrow="二选一"
        title={`${toolA.name} 还是 ${toolB.name}？`}
        description={
          hasDiffs
            ? '先看事实差异，再看编辑判断 —— 事实表任何一对都有，判断只在我们写过的地方出现。'
            : '这两个在价格、平台、分类、更新上没有可数的差异。事实表照旧列出全部字段，差别要靠下面的编辑判断。'
        }
      />

      {/* ── 第 1 层：事实对照表（骨架，任何一对都能渲染） ─────────── */}
      <section className="mt-8" aria-labelledby="facts-heading">
        <h2
          id="facts-heading"
          className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground"
        >
          <Scale className="h-4 w-4 text-gongke-accent" aria-hidden="true" />
          事实对照
        </h2>
        {/* 用 `<table>` 而不是 div 网格：这是真正的二维对照数据，读屏用户
            需要行列关系才能听懂「A 的价格 vs B 的价格」。

            **移动端不能给 `min-width`**（2026-10-22 实测修正）。
            原来写 `min-w-[34rem]`（544px），而 390 宽下可用宽度只有 358 ——
            表格横向溢出 187px，**被切掉的正好是「对手那一列」的 5 个单元格**
            （表头、价格、平台、分类、更新日期）。也就是说读者打开对比页看到的
            是「A 的完整信息 + B 一个字都看不到」—— 那比不做对比页更糟，因为
            他会以为这页只有 A 的信息。

            实测去掉 `min-w` 后：表格 356×260px，**零单元格被截断**，代价只有
            +59px 高度（201.5 → 260），在 3800px 的页面上可以忽略。

            **不改成堆叠**：对比页的核心是「同一行看两边」，堆叠后「价格档」在
            两块里各出现一次，眼睛要来回跳 —— 那是这一页最不该做的事。
            所以只在 ≥768 保留 34rem 下限（宽屏下别让表格被拉得过宽）。 */}
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full text-left text-[13px] md:min-w-[34rem]">
            <thead className="bg-foreground/[0.03]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                  项目
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-foreground">
                  {toolA.name}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-foreground">
                  {toolB.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {facts.map((row) => (
                <tr key={row.label} className="border-t border-foreground/[0.07]">
                  <th scope="row" className="px-4 py-2.5 font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  <td
                    className={`px-4 py-2.5 ${row.differs ? 'font-medium text-foreground' : 'text-foreground/70'}`}
                  >
                    {row.a}
                  </td>
                  <td
                    className={`px-4 py-2.5 ${row.differs ? 'font-medium text-foreground' : 'text-foreground/70'}`}
                  >
                    {row.b}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          以上来自站内采集快照，缺失项如实显示为「—」而不做推测。价格以各工具官网为准。
        </p>
      </section>

      {/* ── 第 2 层：差异高亮（compare 页真正的价值） ─────────────── */}
      {/* 这一节**永远渲染**，包括没有差异的时候。
          2026-10-22 之前是 `diffs.length > 0 &&`，于是约 20 个「两个工具处处
          相同」的页面上这一节整块消失，而页面开头仍在承诺「先看事实差异」——
          读者会以为没加载完。现在无差异时给一句明确的事实陈述：
          「没有可数的差异」本身是有价值的信息（说明这两个几乎一样），
          不该表现为一片空白。见 `hasDiffs` 处的说明。 */}
      <section className="mt-6" aria-labelledby="diff-heading">
        <h2 id="diff-heading" className="mb-2.5 text-[13px] font-semibold text-foreground">
          差在哪
        </h2>
        {hasDiffs ? (
          <ul className="space-y-1.5">
            {diffs.map((r) => (
              <li
                key={r.label}
                className="flex flex-wrap gap-x-2 rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] px-3 py-2 text-[13px] leading-relaxed"
              >
                <span className="shrink-0 font-medium text-foreground">{r.label}：</span>
                <span className="text-foreground/80">
                  {toolA.name} <span className="font-medium">{r.a}</span>
                  <span className="mx-1.5 text-muted-foreground">/</span>
                  {toolB.name} <span className="font-medium">{r.b}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">
            这两个在价格档、支持平台、所属分类、收录更新上
            <span className="font-medium text-foreground">没有可数的差异</span>
            {' '}—— 它们几乎是同一类东西。真正的区别要靠下面的编辑判断，或者点进各自页面看完整介绍。
          </p>
        )}
      </section>

      {/* ── 第 3 层：编辑判断并排（有则并排，缺则如实说没有） ──────── */}
      <section className="mt-8" aria-labelledby="verdict-heading">
        <h2
          id="verdict-heading"
          className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground"
        >
          <Sparkles className="h-4 w-4 text-gongke-accent" aria-hidden="true" />
          怎么选
          <span className="ml-1 rounded-full bg-gongke-accent/10 px-2 py-0.5 text-[11px] font-medium text-gongke-accent">
            编辑判断
          </span>
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <VerdictColumn tool={toolA} verdict={va} />
          <VerdictColumn tool={toolB} verdict={vb} />
        </div>
      </section>

      {/* ── 其他对比 ─────────────────────────────────────────── */}
      {siblings.length > 0 && (
        <section className="mt-10 border-t border-foreground/10 pt-8">
          <h2 className="mb-4 text-[19px] font-semibold text-foreground">其他对比</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {siblings.map((p) => {
              const x = toolBySlug.get(p.a);
              const y = toolBySlug.get(p.b);
              if (!x || !y) return null;
              return (
                <Link prefetch={false}
                  key={p.slug}
                  href={`/compare/${p.slug}`}
                  className="group flex items-center gap-2 rounded-lg border border-foreground/10 bg-card px-3 py-2 text-[13px] transition-all duration-150 hover:-translate-y-px hover:border-foreground/20 hover:shadow-sm"
                >
                  <span className="min-w-0 truncate text-foreground/85 group-hover:text-gongke-accent">
                    {x.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">vs</span>
                  <span className="min-w-0 truncate text-foreground/85 group-hover:text-gongke-accent">
                    {y.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 同类推荐：对比完之后读者可能想再找一个候选。 */}
      <section className="mt-10 border-t border-foreground/10 pt-8">
        <h2 className="mb-4 text-[19px] font-semibold text-foreground">还想看看别的</h2>
        <div className={TOOL_GRID}>
          {relatedTools(pair.a, 6)
            .filter((t) => t.slug !== pair.b)
            .slice(0, 6)
            .map((t) => (
              <ToolMiniCard key={t.slug} tool={cardFromTool(t)} />
            ))}
        </div>
      </section>
    </div>
  );
}

/**
 * 一栏编辑判断。
 *
 * `verdict` 为空时**不是**返回 null —— 那会让对比页看起来「一半有内容一半
 * 没有」。这里如实说明「这一侧还没有编辑判断」，并给出「看目录事实」的
 * 出路（事实表就在上面，所以文案里不需要重复）。这与详情页 `ToolVerdict`
 * 的降级块是同一条纪律：**宁可说没有，也不留空盒，更不编造。**
 */
function VerdictColumn({
  tool,
  verdict,
}: {
  tool: NonNullable<ReturnType<typeof toolBySlug.get>>;
  verdict: ToolVerdict | undefined;
}) {
  const primary = tool.categories[0];
  const price = verdict?.price;

  return (
    <section
      className="flex flex-col rounded-xl border border-foreground/10 bg-card p-5"
      aria-labelledby={`col-${tool.slug}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03]">
          {tool.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tool.icon}
              srcSet={iconSrcSet(tool.icon)}
              sizes="44px"
              alt=""
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="h-11 w-11 object-contain"
            />
          ) : (
            <span className="text-base font-bold text-foreground/70">
              {tool.name.slice(0, 1)}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <h3 id={`col-${tool.slug}`} className="text-[17px] font-semibold text-foreground">
            <Link prefetch={false} href={`/tools/${tool.slug}`} className="hover:text-gongke-accent hover:underline">
              {tool.name}
            </Link>
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-gongke-muted">
            {tool.description}
          </p>
        </div>
      </div>

      {!verdict ? (
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          这一侧还没有编辑判断。上面的事实对照表与
          <Link prefetch={false}
            href={`/tools/${tool.slug}`}
            className="mx-1 text-gongke-accent hover:underline"
          >
            完整介绍
          </Link>
          是判断它的依据。
        </p>
      ) : (
        <>
          {verdict.bestFor.length > 0 && (
            <div className="mt-4">
              <h4 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
                <Check className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
                适合
              </h4>
              <ul className="mt-2 space-y-1.5">
                {verdict.bestFor.map((s) => (
                  <li
                    key={s}
                    className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/80"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gongke-accent" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verdict.notFor && verdict.notFor.length > 0 && (
            <div className="mt-4">
              <h4 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
                <Minus className="h-3.5 w-3.5 text-[#B54826]" aria-hidden="true" />
                不适合
              </h4>
              <ul className="mt-2 space-y-1.5">
                {verdict.notFor.map((s) => (
                  <li
                    key={s}
                    className="flex gap-2 text-[13.5px] leading-relaxed text-foreground/80"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#B54826]/70" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verdict.diff && (
            <p className="mt-4 rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] p-3 text-[12.5px] leading-relaxed text-foreground/80">
              <span className="font-medium text-foreground">与同类比：</span>
              {verdict.diff}
            </p>
          )}

          {price && (price.freeTier || (price.from ?? 0) > 0) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-gongke-muted">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {price.freeTier && <span>{price.freeTier}</span>}
              {typeof price.from === 'number' && price.from > 0 && (
                <span>
                  起价 {price.currency === 'USD' ? '$' : '¥'}
                  {price.from}
                  {price.period ? ` / ${price.period}` : ''}
                </span>
              )}
            </p>
          )}
        </>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {primary && (
          <Link prefetch={false}
            href={`/categories/${primary.slug}`}
            className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/10"
          >
            <CategoryIcon name={primary.icon} className="h-3 w-3" />
            {primary.name}
          </Link>
        )}
        <Link prefetch={false}
          href={`/tools/${tool.slug}`}
          className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-gongke-accent hover:underline"
        >
          看完整介绍
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
