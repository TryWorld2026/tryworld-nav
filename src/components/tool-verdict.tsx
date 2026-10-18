import { Check, Minus, Sparkles, Wallet } from 'lucide-react';
import Link from 'next/link';
import { toolBySlug } from '@/lib/data';
import { verdictBySlug } from '@/lib/tool-verdicts';

/**
 * 详情页的「怎么选」面板 —— 回答「我该不该用它」。
 *
 * 位置：hero 与「产品简介」之间。用户读完一句话定位之后，第一个问题不是
 * 「它有什么功能」，而是「适合我吗、和我在用的那个比怎么样」。
 *
 * 数据来自 `lib/tool-verdicts.ts`（人工维护）。**没有条目就整块不渲染** ——
 * 2081 个工具里初期只有十几个有判断数据，其余页面必须零回归，绝不能出现
 * 一个空的「适合谁」标题。
 *
 * 为什么不做成「AI 自动总结」：见 `tool-verdicts.ts` 顶部注释。写错一个价格
 * 或一句对比，比不写更伤信任。
 */
export function ToolVerdict({ slug }: { slug: string }) {
  const verdict = verdictBySlug(slug);
  if (!verdict) return null;

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
