import Link from 'next/link';
import { ChevronRight, Clock3 } from 'lucide-react';
import { ArchiveScrollToCurrent } from '@/components/archive-scroll-to-current';
import { archiveGroups, formatDateFull, issueNumber, weekdayZh } from '@/lib/news-period';
import type { DailyArchiveEntry } from '@/lib/news-period';

/**
 * 日报的「往期」归档列。
 *
 * 形态取自 AIHOT 日报页左栏：按月折叠的年月分组，每个日期一行（日号 + 星期 +
 * 当天头条），年月组默认只展开最近一个月。桌面端是左栏（`aside`），手机端
 * 收成一个 `<details>` 折叠块放在正文之后 —— 手机上把归档放在正文前面会让
 * 读者每次都要先划过一屏历史。
 *
 * 为什么用原生 `<details>`：无 JS、键盘可达、可被浏览器查找定位，比自绘的
 * 手风琴稳。展开状态不做持久化，每次进页面默认展开**正在读的那一期所在的
 * 月份**（不是「最近一个月」—— 读旧刊时最近月里没有当前项，展开了也白展开）。
 */
export function DailyArchive({
  archive,
  current,
  variant = 'aside',
}: {
  archive: DailyArchiveEntry[];
  current: string;
  /** `aside` = 桌面左栏；`inline` = 手机折叠块。 */
  variant?: 'aside' | 'inline';
}) {
  const groups = archiveGroups(archive);
  // 正在读的那一期所在的月份。`archiveGroups` 已按时间倒序（最新月在前），
  // 所以这里**不重排**：读者想看的往往是邻近几天，把当前月提到最前会把
  // 9 月切开、上下文断掉。改为「打开当前月 + 把它滚进可视区」——效果一样
  // （打开页面就能看见自己在哪里），但月份的先后仍然是时间顺序。
  const curMonth = current.slice(0, 7);

  const list = (
    <div className="space-y-1">
      {groups.map((g) => (
        <details key={g.key} open={g.key === curMonth} className="group">
          {/* 月份条自己吸顶：一个月的日期有 20 多行，往下滚时不知道自己在
              哪个月是这类归档最常见的问题。底色必须不透明（`bg-card`），
              否则滚动中的日期会从字缝里透出来。 */}
          <summary className="sticky top-0 z-10 flex cursor-pointer list-none items-center justify-between rounded-lg bg-card px-2 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
            <span>{g.label}</span>
            <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              {g.days.length} 期
              <ChevronRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90"
                aria-hidden="true"
              />
            </span>
          </summary>
          <ul className="mb-1 mt-0.5 space-y-0.5 border-l border-foreground/10 pl-2">
            {g.days.map((d) => {
              const on = d.date === current;
              const num = String(Number(d.date.slice(8, 10)));
              return (
                <li key={d.date}>
                  <Link
                    href={`/news/daily/${d.date}`}
                    aria-current={on ? 'page' : undefined}
                    className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                      on
                        ? 'bg-gongke-accent/10 text-gongke-accent'
                        : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-5 shrink-0 text-right text-sm font-semibold tabular-nums ${
                        on ? 'text-gongke-accent' : 'text-foreground/70'
                      }`}
                    >
                      {num}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] leading-4 text-muted-foreground">
                        {weekdayZh(d.date)}
                        {on ? ' · 当前' : ''}
                      </span>
                      <span className="line-clamp-2 text-xs leading-4">
                        {d.leadTitle ?? '（本期无头条）'}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );

  if (variant === 'inline') {
    return (
      <details className="group mt-10 overflow-hidden rounded-xl border border-foreground/10 bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            往期日报
            <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
              共 {archive.length} 期
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-foreground/5 px-2 py-2">{list}</div>
      </details>
    );
  }

  return (
    <aside className="hidden lg:block" aria-label="往期日报">
      {/* `data-archive-scroll` 是给 `ArchiveScrollToCurrent` 的锚点：归档有
          十几个月份、几百行，读到 3 月的那一期时当前项落在可视区外几百像素，
          左栏停在最顶上，读者看不出「我在哪儿」。这个盒子是唯一需要被滚动
          的容器，所以标记打在它身上，而不是 `<aside>` 上。 */}
      <div
        data-archive-scroll
        className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto scrollbar-thin pr-2"
      >
        <div className="mb-3 flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold text-foreground">往期</h2>
          <span className="text-[11px] text-muted-foreground">共 {archive.length} 期</span>
        </div>
        <ArchiveScrollToCurrent />
        {list}
        <p className="mt-4 border-t border-foreground/5 px-2 pt-3 text-[11px] leading-relaxed text-muted-foreground">
          第 {issueNumber(archive, current) || '—'} 期 · {formatDateFull(current)}
          <br />
          每天 08:00（北京时间）出刊
        </p>
      </div>
    </aside>
  );
}

/**
 * 日报头部的紧凑日历：当月网格，有出刊的日期可点。
 *
 * 只在桌面右栏出现。一个月 30 来格，信息密度高但不喧宾夺主 —— 它回答的是
 * 「这个月出了几期、我漏了哪几天」，而不是主阅读路径。
 */
export function DailyMiniCalendar({
  calendar,
  current,
  monthCount,
}: {
  calendar: NonNullable<ReturnType<typeof import('@/lib/news-period').monthCalendar>>;
  current: string;
  monthCount: number;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-card p-3.5">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">{calendar.label}</h3>
        <span className="text-[11px] text-muted-foreground">本月 {monthCount} 期</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
        {calendar.cells.map((c, i) => {
          if (!c) return <span key={`x${i}`} aria-hidden="true" />;
          const on = c.date === current;
          if (!c.hasIssue) {
            // `/35` 在纸底上的对比度只有 1.58:1 —— 等于「看不见但还在读屏树
            // 里」，比不渲染更糟。升到 `/70`（2.74:1）保住「这月没有日报」的
            // 层级差别，同时真的能读出来。
            return (
              <span key={c.date} className="rounded-md py-1 text-muted-foreground/70 tabular-nums">
                {c.day}
              </span>
            );
          }
          return (
            <Link
              key={c.date}
              href={`/news/daily/${c.date}`}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-6 items-center justify-center rounded-md py-1 tabular-nums transition-colors ${
                on
                  ? 'bg-gongke-accent font-semibold text-white'
                  : 'text-foreground/70 hover:bg-gongke-accent/10 hover:text-gongke-accent'
              }`}
            >
              {c.day}
            </Link>
          );
        })}
      </div>
      <p className="mt-2.5 flex items-center gap-1 border-t border-foreground/5 pt-2 text-[10px] text-muted-foreground">
        <Clock3 className="h-3 w-3" aria-hidden="true" />
        每天 08:00 出刊，深色数字为已出版
      </p>
    </div>
  );
}
