/**
 * 工具栈的并排对比表 —— `/favorites` 与 `/stack` 共用同一份渲染。
 *
 * 为什么抽出来：这张表出现在两个页面上（自己的栈、别人分享来的栈），
 * 而它的**诚实性约束**是产品级的：
 *   - 九行**固定顺序**（`STACK_COMPARE_ROWS`），换了对比对象，眼睛还在同一行；
 *   - 只放事实与判断原文，不写「谁更好」、不排序；
 *   - 缺数据写 `—` / 「未写判断」，不留空、不推测。
 * 两处各写一份，早晚会有一处偷偷加一句「更推荐」。抽成一个组件，规则只有一处。
 *
 * 多值单元格（平台 / 适合 / 不适合）才按 `LIST_SEP` 拆行 —— 判据是**字段语义**，
 * 不是「字符串里恰好有分隔符」：`起价 $20 / 月` 里也有 ` / `，一视同仁地拆会把
 * 一个价格渲染成两条列表（2026-10-23 实测过的真实缺陷）。
 */

import Link from 'next/link';
import { LIST_SEP, type StackCompareRow } from '@/lib/stack-export';

const MULTI_VALUE_ROWS = new Set<string>(['platforms', 'bestFor', 'notFor']);

export type StackCompareColumn = { slug: string; name: string };

export function StackCompareTable({
  tools,
  rows,
  caption,
}: {
  tools: readonly StackCompareColumn[];
  rows: readonly StackCompareRow[];
  /** 给读屏器的一句话说明，默认按工具名拼。 */
  caption?: string;
}) {
  if (tools.length < 2 || rows.length === 0) return null;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-foreground/10 bg-card lg:block">
        <table className="w-full min-w-[36rem] table-fixed border-collapse text-xs">
          <caption className="sr-only">
            {caption ?? `${tools.map((t) => t.name).join('、')} 的可比较事实与编辑判断`}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="w-[7.5rem] border-b border-foreground/10 px-3 py-2.5 text-left font-medium text-muted-foreground"
              >
                项目
              </th>
              {tools.map((t) => (
                <th
                  key={t.slug}
                  scope="col"
                  className="border-b border-l border-foreground/10 px-3 py-2.5 text-left align-bottom"
                >
                  <Link
                    prefetch={false}
                    href={`/tools/${t.slug}`}
                    className="block text-sm font-semibold leading-snug text-foreground hover:text-gongke-accent"
                  >
                    {t.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="align-top">
                <th scope="row" className="px-3 py-2.5 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                {row.cells.map((cell, i) => (
                  <td
                    key={tools[i]?.slug ?? i}
                    className="border-l border-foreground/[0.07] px-3 py-2.5 leading-relaxed text-foreground/80"
                  >
                    {MULTI_VALUE_ROWS.has(row.key) && cell.includes(LIST_SEP) ? (
                      <ul className="space-y-0.5">
                        {cell.split(LIST_SEP).map((part) => (
                          <li key={part}>{part}</li>
                        ))}
                      </ul>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* ── <1024：按工具纵向对照 ──────────────────────────────────
          为什么不在手机上横向滚动：390px 里一张三列表格，第二列（对手）
          整个被切在屏幕外 —— 而「并排对比」的全部价值就是同时看到两列。
          实测 /compare 也踩过同一个坑（见 CLAUDE.md 坑表）。改成每个工具
          一节、行名在左、值在右，纵向滚动的代价远小于看不到一半内容。 */}
      <div className="space-y-3 lg:hidden">
        {tools.map((t) => (
          <section
            key={t.slug}
            className="rounded-2xl border border-foreground/10 bg-card p-4"
            aria-label={t.name}
          >
            <h3 className="mb-2 flex items-baseline gap-2 border-b border-foreground/[0.07] pb-2">
              <Link
                prefetch={false}
                href={`/tools/${t.slug}`}
                className="text-sm font-semibold text-foreground hover:text-gongke-accent"
              >
                {t.name}
              </Link>
              <span className="text-2xs text-muted-foreground">详情</span>
            </h3>
            <dl className="space-y-2">
              {rows.map((row) => {
                const cell = row.cells[tools.findIndex((x) => x.slug === t.slug)] ?? '—';
                return (
                  <div key={row.key} className="flex gap-3 text-xs leading-relaxed">
                    <dt className="w-[5.5rem] shrink-0 text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 flex-1 text-foreground/80">
                      {MULTI_VALUE_ROWS.has(row.key) && cell.includes(LIST_SEP) ? (
                        <ul className="space-y-0.5">
                          {cell.split(LIST_SEP).map((part) => (
                            <li key={part}>{part}</li>
                          ))}
                        </ul>
                      ) : (
                        cell
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
