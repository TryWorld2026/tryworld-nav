'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronRight,
  Compass,
  Link2,
  Minus,
  RotateCcw,
  Scale,
  Sparkles,
} from 'lucide-react';
import { asset } from '@/lib/assets';
import { mergeFavorites, readStore, writeStore } from '@/lib/favorites';
import { navCategories } from '@/lib/nav';
import { VERDICTS_BY_SLUG, VERDICT_BASIS, VERDICT_COUNT } from '@/lib/verdict-index';
import {
  DECIDE_BUDGETS,
  DECIDE_DEFAULTS,
  DECIDE_PLATFORMS,
  DECIDE_TASKS,
  DECIDE_TASTES,
  buildDecideQuery,
  compareHref,
  countByTask,
  dayFromISO,
  decide,
  isStale,
  parseDecideParams,
  updatedMonth,
  type DecideEntry,
  type DecidePick,
  type DecidePrefs,
  type DecideReject,
} from '@/lib/decide';

/**
 * `/decide`（帮我选）的交互层。
 *
 * 页面只做一件事：**把 2081 条目录缩成 3 个候选，并说清为什么**。所以这里
 * 刻意不做「AI 生成」的观感 —— 没有打字机、没有"分析中"、没有置信度百分比。
 * 屏幕上出现的每一句话都必须能指回三样东西之一：编辑写的判断原文、收录快照
 * 里的价格/平台事实、`tools.json` 的目录排位。
 *
 * 状态与 URL 是一对（`?task=&budget=&plat=&taste=`）：分享一个链接＝分享同一组
 * 条件，这也让「帮我选」能被贴进群里而不是让朋友再点四遍。
 *
 * 一个实现约束：**首屏（SSR）必须是默认态**。URL 在 `useEffect` 里读，否则
 * 静态导出的 HTML 与挂载后的第一帧不一致，React 会报 hydration 错误 ——
 * 这个站每个页面都是构建期渲染好的，这条尤其不能踩。
 */

const ENTRIES = VERDICTS_BY_SLUG as unknown as Record<string, DecideEntry>;
const BASIS_DAY = dayFromISO(VERDICT_BASIS.generatedAt);
const TASK_COUNTS = countByTask(ENTRIES);
const CATEGORY_NAME = new Map(navCategories.map((c) => [c.slug, c.name]));

/** `2025 年 8 月` 里那串数字的宽度要稳，否则一排卡片的高度参差。 */
function priceLabel(entry: DecideEntry): string {
  const p = entry.verdictPrice;
  if (p?.from && p.currency && p.period) {
    const symbol = p.currency === 'USD' ? '$' : '¥';
    return `${symbol}${p.from}/${p.period}`;
  }
  if (p?.free) return '有免费额度';
  if (entry.price === 'fully-free') return '完全免费';
  if (entry.price === 'open-source') return '开源';
  return '价格未采集';
}

function PriceDetail({ entry }: { entry: DecideEntry }) {
  const p = entry.verdictPrice;
  if (!p) {
    return <span className="text-muted-foreground">{entry.price === 'paid' ? '付费' : priceLabel(entry)}</span>;
  }
  return (
    <span className="text-muted-foreground">
      {p.free ?? (entry.price === 'fully-free' ? '完全免费' : '价格未采集')}
      {p.from && p.currency && p.period ? (
        <>
          {' · '}
          <span className="font-medium text-foreground/80">
            起价 {p.currency === 'USD' ? '$' : '¥'}
            {p.from}/{p.period}
          </span>
        </>
      ) : null}
      <span className="text-muted-foreground"> · 核对于 {p.checkedAt}</span>
    </span>
  );
}

/** 一段条件行：左侧固定宽的标题 + 右侧控件。手机上标题在上、控件在下。 */
function Row({
  index,
  label,
  note,
  children,
}: {
  index: number;
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-foreground/[0.07] py-3.5 first:border-t-0 first:pt-0 md:flex-row md:items-start md:gap-5">
      <div className="flex shrink-0 items-baseline gap-2 md:w-[7.5rem] md:flex-col md:gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground/[0.06] text-[10px] tabular-nums text-foreground/75">
            {index}
          </span>
          {label}
        </span>
        {note ? (
          <span className="text-[11.5px] leading-snug text-muted-foreground md:mt-0.5">{note}</span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** 单选胶囊。`aria-pressed` 是给交互测试与读屏器的唯一语义。 */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={
              'inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[12.5px] transition-colors md:min-h-8 ' +
              (on
                ? 'border-gongke-accent/40 bg-gongke-accent/[0.10] font-medium text-gongke-accent'
                : 'border-foreground/15 bg-card text-foreground/70 hover:border-foreground/25 hover:text-foreground')
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PickCard({
  pick,
  rank,
  basisDay,
}: {
  pick: DecidePick;
  rank: number;
  basisDay: number;
}) {
  const { slug, entry } = pick;
  const catName = entry.cats.map((c) => CATEGORY_NAME.get(c)).find(Boolean) ?? '未分类';
  const stale = isStale(entry.updated, basisDay);
  const compare = compareHref(slug, ENTRIES);
  const first = rank === 1;

  return (
    <article
      className={
        'flex min-w-0 flex-col rounded-2xl border bg-card p-4 transition-shadow md:p-5 ' +
        (first
          ? 'border-gongke-accent/35 shadow-md shadow-foreground/[0.04]'
          : 'border-foreground/10')
      }
      data-testid={`decide-pick-${rank}`}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
            (first ? 'bg-gongke-accent text-white' : 'bg-foreground/[0.06] text-foreground/75')
          }
        >
          {first ? '首选' : rank === 2 ? '次选' : '第三'}
        </span>
        <span className="truncate text-[11.5px] text-muted-foreground">{catName}</span>
      </div>

      <Link prefetch={false} href={`/tools/${slug}`} className="group flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(entry.icon)}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-inset ring-foreground/5"
        />
        <h3 className="min-w-0 truncate font-display text-[17px] font-semibold leading-tight text-foreground transition-colors group-hover:text-gongke-accent">
          {entry.name}
        </h3>
      </Link>

      <div className="mt-3.5">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          适合
        </p>
        <ul className="space-y-1">
          {entry.bestFor.slice(0, 2).map((b) => (
            <li key={b} className="flex gap-1.5 text-[13px] leading-relaxed text-foreground/85">
              <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-gongke-accent" aria-hidden="true" />
              <span className="min-w-0">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {entry.notFor[0] ? (
        <div className="mt-2.5">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            不适合
          </p>
          <p className="flex gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
            <Minus className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{entry.notFor[0]}</span>
          </p>
        </div>
      ) : null}

      <div className="mt-3.5 space-y-1 border-t border-foreground/[0.07] pt-3 text-[12px] leading-relaxed">
        <p>
          <PriceDetail entry={entry} />
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
          <span>{entry.platforms.slice(0, 3).join(' · ') || '平台未采集'}</span>
          {entry.updated ? (
            <span className={stale ? 'inline-flex items-center gap-1 text-foreground/60' : ''}>
              · 收录更新 {updatedMonth(entry.updated)}
              {stale ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-foreground/60">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  已超一年
                </span>
              ) : null}
            </span>
          ) : null}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Link
          prefetch={false}
          href={`/tools/${slug}`}
          className="inline-flex min-h-9 items-center gap-1 rounded-full bg-foreground/[0.06] px-3 text-[12.5px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.10] hover:text-foreground"
        >
          查看详情
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {compare ? (
          <Link
            prefetch={false}
            href={compare}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-foreground/15 px-3 text-[12.5px] text-foreground/70 transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            与 {ENTRIES[entry.vs ?? '']?.name ?? '同类'} 比
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function RejectRow({ reject }: { reject: DecideReject }) {
  const { slug, entry, reasons } = reject;
  return (
    <div className="flex min-w-0 items-start gap-3 border-t border-foreground/[0.07] py-3 first:border-t-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(entry.icon)}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        decoding="async"
        className="mt-0.5 h-7 w-7 shrink-0 rounded-md bg-white object-contain ring-1 ring-inset ring-foreground/5"
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <Link
            prefetch={false}
            href={`/tools/${slug}`}
            className="text-[13.5px] font-medium text-foreground hover:text-gongke-accent"
          >
            {entry.name}
          </Link>
          <span className="text-[12px] text-muted-foreground">{reasons.join('、')}</span>
        </p>
        {entry.notFor[0] ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            编辑判断里还写着：{entry.notFor[0]}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DecideFlow() {
  const [prefs, setPrefs] = useState<DecidePrefs>(DECIDE_DEFAULTS);
  const [ready, setReady] = useState(false);
  /**
   * 「把这三个加进我的工具栈」的结果。
   *
   * `null` = 还没点过；`{added}` = 点过，`added` 是**新增**条数（0 表示三个都
   * 已经在栈里）。条件一变就清空 —— 否则换一个场景后，上一组的三选一还会
   * 顶着「已加进工具栈」，读者会以为刚才那一组也被存了。
   */
  const [saved, setSaved] = useState<{ added: number } | null>(null);
  /** 「复制这组条件的链接」的反馈：2.2 秒后自动复位。 */
  const [linkCopied, setLinkCopied] = useState(false);

  // URL → 条件（仅挂载后）。见文件头：首屏必须是默认态。
  useEffect(() => {
    setPrefs(parseDecideParams(window.location.search));
    setReady(true);
    const onPop = () => setPrefs(parseDecideParams(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback((patch: Partial<DecidePrefs>) => {
    setSaved(null);
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      const qs = buildDecideQuery(next);
      // `history.replaceState` 而不是 `router.replace`：后者每点一次条件都会
      // 向 Next 请求一次 RSC payload（全站链接都预取 `.txt?_rsc=`），
      // 一个四步的选择会变成一串网络请求。
      window.history.replaceState(null, '', qs || window.location.pathname);
      return next;
    });
  }, []);

  const result = useMemo(() => decide(ENTRIES, prefs, { basisDay: BASIS_DAY }), [prefs]);

  /**
   * 把这一组三个候选一次存进本机工具栈。
   *
   * 为什么用 `mergeFavorites` 而不是逐个 `toggleFavorite`：**已收藏的不能
   * 被顺手取消**。用户可能早就收过首选那个，点「全部加进栈」的预期是「补齐
   * 缺的」，不是「把已有的删掉再存一遍」。收藏只写本机，`writeStore` 会广播
   * 事件，`/favorites` 切换过去时立刻能看到。
   */
  /**
   * 复制「这组条件」的链接。
   *
   * 条件早就写进 URL 了（`?task=video&budget=free`），但没人会想到「地址栏
   * 那个地址可以发出去」。而这个站最自然的传播单位恰恰是**一组条件**
   * （「我要做短视频，预算只能免费，你帮我看看」），不是单个工具页。
   * 复制 `window.location.href` 即可 —— `replaceState` 一直在维护它。
   */
  const copyConditionLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      // 剪贴板被拒（非 https / 浏览器策略）时不假装成功。
      setLinkCopied(false);
    }
  }, []);

  const saveAll = useCallback(() => {
    const items = result.picks.map((p) => ({
      slug: p.slug,
      name: p.entry.name,
      description: '',
      // 存绝对路径：`/favorites` 与导出件都直接用它，避免两处各拼一次前缀。
      icon: asset(p.entry.icon),
    }));
    const { store, added } = mergeFavorites(readStore(), items);
    if (added > 0) writeStore(store);
    setSaved({ added });
  }, [result.picks]);

  const task = result.task;

  return (
    <div className="space-y-6">
      {/* ── 条件面板 ───────────────────────────────────────────── */}
      <section
        aria-labelledby="decide-questions"
        className="rounded-2xl border border-foreground/10 bg-card p-4 md:p-6"
      >
        <h2 id="decide-questions" className="sr-only">
          选择条件
        </h2>

        <Row index={1} label="你想做什么" note="先选一个场景">
          <div
            role="group"
            aria-label="想做什么"
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4"
          >
            {DECIDE_TASKS.map((t) => {
              const on = prefs.task === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ task: on ? null : t.id })}
                  className={
                    'flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-[12.5px] leading-tight transition-colors ' +
                    (on
                      ? 'border-gongke-accent/40 bg-gongke-accent/[0.10] font-medium text-gongke-accent'
                      : 'border-foreground/10 bg-background text-foreground/75 hover:border-foreground/20 hover:text-foreground')
                  }
                >
                  <span className="min-w-0 flex-1">{t.label}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-foreground/70">
                    {TASK_COUNTS[t.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </Row>

        <Row index={2} label="预算" note="完全免费不含免费增值">
          <Segmented
            label="预算"
            value={prefs.budget}
            options={DECIDE_BUDGETS.map((b) => ({ id: b.id, label: b.label }))}
            onChange={(v) => update({ budget: v })}
          />
        </Row>

        <Row index={3} label="平台" note="网页版算可用">
          <Segmented
            label="平台"
            value={prefs.plat}
            options={DECIDE_PLATFORMS.map((p) => ({ id: p.id, label: p.label }))}
            onChange={(v) => update({ plat: v })}
          />
        </Row>

        <Row index={4} label="偏好" note="只加分，不硬筛">
          <Segmented
            label="偏好"
            value={prefs.taste}
            options={DECIDE_TASTES.map((t) => ({ id: t.id, label: t.label }))}
            onChange={(v) => update({ taste: v })}
          />
        </Row>
      </section>

      {/* ── 结果 ───────────────────────────────────────────────── */}
      {!task ? (
        <section className="rounded-2xl border border-dashed border-foreground/15 px-5 py-12 text-center">
          <Compass className="mx-auto mb-3 h-7 w-7 text-foreground/25" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground/80">先在上面的 16 个场景里选一个</p>
          <p className="mx-auto mt-1.5 max-w-[42ch] text-[12.5px] leading-relaxed text-muted-foreground">
            选一个你想做的事，我们用 {VERDICT_COUNT} 条人工判断把 2081 个工具缩到 3 个。
            没有任务就没有「相关」，所以这里不会先塞给你一堆热门工具。
          </p>
        </section>
      ) : (
        <section aria-labelledby="decide-result" data-testid="decide-results">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h2 id="decide-result" className="font-display text-[22px] font-semibold text-foreground">
                {task.label}
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground" aria-live="polite">
                这一类里有编辑判断的 <span className="font-medium text-foreground/80">{result.inCategory}</span> 个，
                按你的条件筛出 <span className="font-medium text-foreground/80">{result.matched}</span> 个
                {/* 数量句必须和下面真的渲染了几张卡一致。
                    之前写死「以下是前 3」，筛出 1 个时就成了
                    「筛出 1 个，以下是前 3」—— 页面在承诺它没做的事。 */}
                {result.matched === 0
                  ? '。'
                  : result.matched === 1
                    ? '。'
                    : result.matched > 3
                      ? '，以下是前 3。'
                      : '，都在下面。'}
              </p>
            </div>
            {ready && prefs.task ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* 把「一组条件」本身发出去 —— 这一页最自然的传播单位不是某个
                    工具，而是「我要做短视频、预算只能免费」这种组合。 */}
                <button
                  type="button"
                  onClick={copyConditionLink}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/15 px-3 text-[12.5px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                >
                  {linkCopied ? (
                    <Check className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {linkCopied ? '已复制这组条件' : '复制这组条件'}
                </button>
                <button
                  type="button"
                  onClick={() => update({ ...DECIDE_DEFAULTS, task: prefs.task })}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/15 px-3 text-[12.5px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  重置条件
                </button>
              </div>
            ) : null}
          </div>

          {result.empty ? (
            <div className="rounded-2xl border border-dashed border-foreground/15 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground/80">
                这一类里没有同时满足这三个条件的工具
              </p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-[12.5px] leading-relaxed text-muted-foreground">
                这不代表没有能用的工具，只代表「我们有编辑判断」的那 {result.inCategory} 个里没有。
                放宽任意一条就能看到候选：
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {result.relaxable.platform ? (
                  <button
                    type="button"
                    onClick={() => update({ plat: 'any' })}
                    className="inline-flex min-h-9 items-center rounded-full border border-gongke-accent/30 bg-card px-3 text-[12.5px] font-medium text-gongke-accent hover:bg-gongke-accent/[0.08]"
                  >
                    不限平台
                  </button>
                ) : null}
                {result.relaxable.budget ? (
                  <button
                    type="button"
                    onClick={() =>
                      update({ budget: prefs.budget === 'free' ? 'free-tier' : 'any' })
                    }
                    className="inline-flex min-h-9 items-center rounded-full border border-gongke-accent/30 bg-card px-3 text-[12.5px] font-medium text-gongke-accent hover:bg-gongke-accent/[0.08]"
                  >
                    放宽预算
                  </button>
                ) : null}
                <Link
                  prefetch={false}
                  href={`/categories/${task.category}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-foreground/15 px-3 text-[12.5px] text-foreground/70 hover:border-foreground/25 hover:text-foreground"
                >
                  看这一类全部工具
                </Link>
              </div>
            </div>
          ) : (
            /* 列数跟候选数走：只剩 1 个时铺三列会在右边留出两格空白，
               整块看起来像没加载完。 */
            <div
              className={
                'grid gap-4 ' +
                (result.picks.length === 1
                  ? 'max-w-[30rem] grid-cols-1'
                  : result.picks.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-3')
              }
              data-testid="decide-picks"
            >
              {result.picks.map((p, i) => (
                <PickCard key={p.slug} pick={p} rank={i + 1} basisDay={BASIS_DAY} />
              ))}
            </div>
          )}

          {/* 决策 → 工具栈：这一页给的是「临时结论」，下一步通常是「留着、比一比、
              发给别人」。没有这一步，读者得自己点进三个详情页分别收藏一次。
              只在本机写 localStorage，不涉及账号（与 /favorites 同一份存储）。 */}
          {!result.empty ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
              <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">
                把这三个一起存进「我的工具栈」，就能并排对比价格与平台、导出成 Markdown
                —— 或者生成一条链接发给同事。
              </p>
              {saved ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-gongke-accent"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {saved.added > 0
                      ? `已加进工具栈（新增 ${saved.added} 个）`
                      : '这三个都已经在你的工具栈里'}
                  </span>
                  <Link
                    prefetch={false}
                    href="/favorites"
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-foreground/15 px-3 text-[12.5px] font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
                  >
                    去工具栈看看
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={saveAll}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-gongke-accent/30 bg-card px-3.5 text-[12.5px] font-medium text-gongke-accent transition-colors hover:border-gongke-accent/50 hover:bg-gongke-accent/[0.08]"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  把这三个加进我的工具栈
                </button>
              )}
            </div>
          ) : null}

          {result.rejects.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 md:p-5">
              <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
                我们没选它们
              </h3>
              <p className="mb-2 text-[12px] leading-relaxed text-muted-foreground">
                这几个在目录里排得更前、你更可能自己撞见，但它们没过你的条件 —— 原因写在这里，而不是藏起来。
              </p>
              <div>
                {result.rejects.map((r) => (
                  <RejectRow key={r.slug} reject={r} />
                ))}
              </div>
            </div>
          ) : null}

          {/* 依据：把打分规则明写出来。不给分数、只给依据。
              `[&::-webkit-details-marker]:hidden` + `list-none` 去掉默认三角，
              换成能跟着 open 旋转的 chevron —— 默认三角在纸色卡片上读起来像
              浏览器自带控件的残渣。 */}
          <details className="group mt-5 rounded-xl border border-foreground/10 bg-card px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-medium text-foreground/70 transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              这 3 个是怎么排出来的
            </summary>
            <div className="mt-2.5 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
              <p>候选池只有「编辑写过判断」的 {VERDICT_COUNT} 个工具（全站 2081 个收录里）。先按你的预算与平台做硬筛，再按下面的依据排序：</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li><strong className="font-medium text-foreground/75">主分类就是这个场景</strong>的排在前面 —— 有些工具同时挂在 3 个分类下，主业算第一个；</li>
                <li>编辑自己审过的判断（editor）优先于「来自官方定价页」（sourced）；</li>
                <li>命中你选的偏好标签（编辑推荐 / 大厂出品 / 新兴初创）加分；</li>
                <li>收录快照在一年内的加分 —— 大多数工具加不到，这是事实，不掩饰；</li>
                <li>目录排位靠前加分。本站没有评分与装机量，「排位」只是 tools.json 的原始顺序。</li>
              </ol>
              <p>
                判断最新核对于 {VERDICT_BASIS.generatedAt}；价格与平台来自收录快照，以官网为准。
                我们不卖排名，也没有任何一条判断是付费的。
              </p>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
