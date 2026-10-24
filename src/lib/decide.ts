/**
 * `/decide`（帮我选）的筛选与排序 —— **零 import 的纯函数**。
 *
 * 为什么零 import：本文件要被 `node --test tests/decide.test.mjs` 直接 import，
 * 而 Node 的原生 TS 解析**要求相对 import 带扩展名**，TSC 的
 * `moduleResolution: bundler` 又不接受 `.ts` 后缀 —— 两边都要成立，唯一做法
 * 是让被测试的文件零依赖，所需数据由调用方传入（与 `lib/compare.ts` /
 * `lib/card-sort.ts` / `lib/search.ts` 同一条约束，理由见 CLAUDE.md）。
 *
 * ## 这一页的产品定义（不要在别处另发明一套）
 *
 * 用户带着一个模糊的任务来（「我要做个短视频」），站内 2081 个工具，`/tools`
 * 只能让他自己一页页挑。`/decide` 用**三个可验证的条件**从**有编辑判断**的
 * 363 条里筛出 3 个，并写清楚为什么是它们、为什么不推荐另外几个。
 *
 * 三个条件全部可选、默认「不限」：① 想做什么（16 个分类入口）② 预算
 * ③ 平台。④ 偏好（编辑推荐 / 大厂出品 / 新兴初创）不是硬筛，只加分。
 *
 * ## 打分规则（逐条可解释，页面上有一行小字同步写着）
 *
 *   1. `confidence === 'editor'` +3（编辑自己审过）；`sourced` +2（来自官方定价页）。
 *   2. 命中 ④ 的标签 +3（没选偏好 = 0）。
 *   3. 新鲜度：`updated` 距判断基准日不超过 365 天 +1。
 *      **大多数工具 +0 —— 这是事实，不掩盖**：363 条里 88% 的收录快照超过一年。
 *   4. 目录排位：`+ 1.5 * (1 - order / 2081)`。`order` 是 `tools.json` 的原始
 *      序号，本站没有评分、没有装机量，这是「同类里排第几」唯一可用的客观依据；
 *      页面上必须叫它「目录排位」，不能包装成「热度」「评分」。
 *
 * 同分按 `order` 升序，再按 slug 字典序（保证同一输入永远同一顺序 ——
 * 纯静态导出要求字节稳定）。
 *
 * 分数本身**不出现在页面上**：给读者看一列 4.3 / 4.1 只会让人以为这是拍脑袋
 * 的评分。页面展示的是每条规则的**依据**（编辑审过 / 命中你的偏好 / 排位靠前），
 * 那才是「可解释」的意思。
 */

/** 价格档 —— 与 `lib/search.ts` 的 `PRICE_CODES` 同值（此处独立声明，零 import）。 */
export type DecidePriceCode =
  | 'fully-free'
  | 'open-source'
  | 'freemium'
  | 'paid'
  | 'unrated';

/** 判断条目里的一条价格事实。没有明确起价时 `from` 为空（不要填 0）。 */
export type DecideVerdictPrice = {
  free?: string;
  from?: number;
  currency?: 'CNY' | 'USD';
  period?: '月' | '年' | '次';
  checkedAt: string;
};

/**
 * 一条候选工具 —— `data/verdict-index.json` 的条目结构上满足它。
 *
 * 刻意只声明**这里真的会读**的字段：`lib/verdict-index.ts` 的类型更宽
 * （它还要给 `/favorites` 用），而这里多声明一个用不到的字段就意味着将来
 * 数据改形状时多一处假依赖。
 */
export type DecideEntry = {
  name: string;
  icon: string;
  cats: string[];
  tags: string[];
  price: DecidePriceCode;
  platforms: string[];
  /** 更新时间，Unix **日序**（不是毫秒）。 */
  updated?: number;
  bestFor: string[];
  notFor: string[];
  diff?: string;
  vs?: string;
  verdictPrice?: DecideVerdictPrice;
  confidence: 'editor' | 'sourced';
  /** 目录序号（`tools.json` 原始顺序），越小越靠前。 */
  order: number;
};

/** slug → 条目。`VERDICTS_BY_SLUG` 结构上满足它。 */
export type DecideEntries = Record<string, DecideEntry>;

/** 站点目录规模 —— 打分里「目录排位」一项的分母，与 `tools.json` 的条数同步。 */
export const DECIDE_CATALOG_SIZE = 2081;

/** 任务表：16 个入口，每个指向一个真实存在的分类 slug。 */
export type DecideTask = {
  /** URL 里的值（`?task=video`），短、稳、不随分类改名而变。 */
  id: string;
  label: string;
  /** `data/categories.json` 里的 slug —— 硬筛用的正是它。 */
  category: string;
};

export const DECIDE_TASKS: DecideTask[] = [
  { id: 'writing', label: '写文案 / 公众号', category: 'ai-writing' },
  { id: 'image', label: '做图 / 海报 / 电商主图', category: 'ai-image-design' },
  { id: 'video', label: '做视频 / 短片', category: 'ai-video-animation' },
  { id: 'audio', label: '配音 / 音乐', category: 'ai-audio-music' },
  { id: 'code', label: '写代码', category: 'ai-coding' },
  { id: 'ppt', label: '做 PPT', category: 'ai-ppt' },
  { id: 'site', label: '做网站 / 落地页', category: 'ai-website-builder' },
  { id: 'paper', label: '读论文 / 文献', category: 'ai-academic-tools' },
  { id: 'search', label: '搜资料 / 查证据', category: 'ai-search-engine' },
  { id: 'meeting', label: '开会记录 / 转写', category: 'ai-notetaker' },
  { id: 'agent', label: '搭智能体 / 工作流', category: 'ai-agents' },
  { id: 'data', label: '表格 / 数据分析', category: 'ai-data-analysis' },
  { id: 'translate', label: '翻译', category: 'ai-translation-tools' },
  { id: 'resume', label: '简历 / 求职', category: 'ai-recruiting-tools' },
  { id: 'law', label: '合同 / 法律', category: 'ai-lawer-tools' },
  { id: 'support', label: '客服', category: 'ai-customer-support' },
];

/** 预算档。`free` 只认完全免费与开源 —— **不含**免费增值（freemium）。 */
export type BudgetId = 'free' | 'free-tier' | 'any';

export const DECIDE_BUDGETS: { id: BudgetId; label: string; note: string }[] = [
  { id: 'free', label: '完全免费', note: '完全免费或开源' },
  { id: 'free-tier', label: '有免费额度就行', note: '再加上有免费额度的' },
  { id: 'any', label: '都可以', note: '含只收付费的' },
];

/**
 * 平台档。语义是「**在这些系统上能用**」——**网页版算能用**。
 *
 * 页面上必须用一句话把这个口径说明白，否则读者会以为「Mac」只算 Mac 客户端，
 * 于是把大部分其实能在浏览器里用的工具一起筛掉。这也是分组里 `Web` 出现在
 * 除「电脑网页」外每一个档位的原因。
 *
 * `iPhone/iPad` 不含 Chrome、`Android` 不含 Chrome：这两个档位问的是
 * 「手机上有没有能用的」，而 Chrome 是桌面浏览器的平台名。
 */
export type PlatformId = 'any' | 'web' | 'windows' | 'mac' | 'ios' | 'android';

export const DECIDE_PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: 'any', label: '不限' },
  { id: 'web', label: '电脑网页' },
  { id: 'windows', label: 'Windows' },
  { id: 'mac', label: 'Mac' },
  { id: 'ios', label: 'iPhone / iPad' },
  { id: 'android', label: 'Android' },
];

const PLATFORM_MATCH: Record<Exclude<PlatformId, 'any'>, string[]> = {
  web: ['Web', 'Chrome'],
  windows: ['Windows', 'Web', 'Chrome'],
  mac: ['Mac', 'Web', 'Chrome'],
  ios: ['iOS', 'iPadOS', 'Web'],
  android: ['Android', 'Web'],
};

/** 偏好（可空，单选）：只加分、不硬筛。 */
export type TasteId = 'any' | 'editor' | 'bigco' | 'startup';

export const DECIDE_TASTES: { id: TasteId; label: string; tag?: string }[] = [
  { id: 'any', label: '不挑' },
  { id: 'editor', label: '编辑推荐', tag: '编辑推荐' },
  { id: 'bigco', label: '大厂出品', tag: '大厂出品' },
  { id: 'startup', label: '新兴初创', tag: '新兴初创' },
];

export type DecidePrefs = {
  task: string | null;
  budget: BudgetId;
  plat: PlatformId;
  taste: TasteId;
};

/** 四项全默认。**默认值不写进 URL**，所以它也是「清空」时的落点。 */
export const DECIDE_DEFAULTS: DecidePrefs = {
  task: null,
  budget: 'any',
  plat: 'any',
  taste: 'any',
};

/** 一个任务 id → 任务；未知 id 返回 undefined（URL 里的脏值据此丢回默认）。 */
export function taskById(id: string | null | undefined): DecideTask | undefined {
  if (!id) return undefined;
  return DECIDE_TASKS.find((t) => t.id === id);
}

/** `YYYY-MM-DD` → Unix 日序。手工拆 Y/M/D，不依赖 `new Date('YYYY-MM-DD')` 的解析口径。 */
export function dayFromISO(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Unix 日序 → `2025 年 8 月`（收录更新只到月，因为日没有信息量）。缺数据返回空串。 */
export function updatedMonth(day: number | undefined): string {
  if (typeof day !== 'number' || Number.isNaN(day)) return '';
  const d = new Date(day * 86_400_000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (!Number.isFinite(y) || !Number.isFinite(m)) return '';
  return `${y} 年 ${m} 月`;
}

/** 是否超过一年（页面上要如实把「快照老了」说成提示色，而不是当新鲜度徽章）。 */
export function isStale(updated: number | undefined, basisDay: number): boolean {
  if (typeof updated !== 'number') return false;
  return basisDay - updated > 365;
}

export function isFreePrice(price: DecidePriceCode): boolean {
  return price === 'fully-free' || price === 'open-source';
}

/** 预算硬筛。`free` **不含** freemium；`unrated` 在两者下都不通过（缺数据不猜）。 */
export function matchesBudget(price: DecidePriceCode, budget: BudgetId): boolean {
  if (budget === 'any') return true;
  if (isFreePrice(price)) return true;
  if (budget === 'free-tier') return price === 'freemium';
  return false;
}

/** 平台硬筛。语义是「在这些系统上能用」，网页版算能用（见 `PLATFORM_MATCH`）。 */
export function matchesPlatform(platforms: string[], plat: PlatformId): boolean {
  if (plat === 'any') return true;
  const need = PLATFORM_MATCH[plat];
  return platforms.some((p) => need.includes(p));
}

/**
 * 「为什么没选它」的预算侧原因 —— **由硬筛结果反推**，不臆断。
 * 通过硬筛返回 null；措辞只描述价格档这一件事。
 */
export function budgetReason(price: DecidePriceCode, budget: BudgetId): string | null {
  if (matchesBudget(price, budget)) return null;
  if (price === 'unrated') return '价格档未采集到，无法确认免费';
  if (isFreePrice(price)) return null; // 理论上到不了这里
  if (price === 'freemium') return '只提供免费额度，不是完全免费';
  return '只支持付费';
}

/** 「为什么没选它」的平台侧原因 —— 同样由硬筛结果反推。 */
export function platformReason(platforms: string[], plat: PlatformId): string | null {
  if (matchesPlatform(platforms, plat)) return null;
  if (plat === 'any') return null;
  switch (plat) {
    case 'mac':
      return '不含 Mac 可用';
    case 'windows':
      return '不含 Windows 可用';
    case 'web':
      return '没有网页版';
    case 'ios':
      return '不含 iPhone / iPad 可用';
    case 'android':
      return '不含 Android 可用';
    default:
      return null;
  }
}

/** 一条候选的得分。规则逐条见文件头，页面上有一行小字同步写着。 */
export function scoreEntry(
  entry: DecideEntry,
  taste: TasteId,
  basisDay: number,
  catalogSize: number = DECIDE_CATALOG_SIZE,
): number {
  let score = entry.confidence === 'editor' ? 3 : 2;

  if (taste !== 'any') {
    const tag = DECIDE_TASTES.find((t) => t.id === taste)?.tag;
    if (tag && entry.tags.includes(tag)) score += 3;
  }

  // 距基准日不超过 365 天 +1；未来的日期按「不旧」算，不额外给分。
  if (typeof entry.updated === 'number' && basisDay - entry.updated <= 365) score += 1;

  score += 1.5 * (1 - entry.order / catalogSize);

  return score;
}

export type DecidePick = {
  slug: string;
  entry: DecideEntry;
  score: number;
};

export type DecideReject = {
  slug: string;
  entry: DecideEntry;
  /** 被哪几条硬筛挡下（真实原因，按预算 → 平台的顺序）。 */
  reasons: string[];
};

export type DecideResult = {
  /** 命中的任务；未选任务时为 null（此时**不推荐任何工具**）。 */
  task: DecideTask | null;
  /** 该类里有编辑判断的条数（不受三个条件影响 —— 口径句的分子之一）。 */
  inCategory: number;
  /** 通过三个硬筛的条数（口径句的另一个分子）。 */
  matched: number;
  picks: DecidePick[];
  /** 被硬筛掉、但目录排位靠前的最多 2 个 —— 「我们没选它」。 */
  rejects: DecideReject[];
  /** 空结果时可以给读者的两个放宽出口；不空时为 false。 */
  relaxable: { platform: boolean; budget: boolean };
  empty: boolean;
};

export type DecideContext = {
  /** 判断基准日（Unix 日序）= `VERDICT_BASIS.generatedAt`。 */
  basisDay: number;
  /** 目录规模；默认 `DECIDE_CATALOG_SIZE`。测试可以传小值。 */
  catalogSize?: number;
};

/**
 * 主入口：硬筛 → 打分 → 前 3 + 反推荐。
 *
 * 未选任务时返回空结果（`task: null`），**刻意不推荐**：没有任务就没有
 * 「相关」可言，瞎推荐比不推荐更伤信任。
 */
export function decide(
  entries: DecideEntries,
  prefs: DecidePrefs,
  ctx: DecideContext,
): DecideResult {
  const task = taskById(prefs.task);

  if (!task) {
    return {
      task: null,
      inCategory: 0,
      matched: 0,
      picks: [],
      rejects: [],
      relaxable: { platform: false, budget: false },
      empty: false,
    };
  }

  const slugs = Object.keys(entries);
  const inCat: { slug: string; entry: DecideEntry }[] = [];
  for (const slug of slugs) {
    const e = entries[slug];
    if (e && e.cats.includes(task.category)) inCat.push({ slug, entry: e });
  }

  const passed: DecidePick[] = [];
  const blocked: DecideReject[] = [];

  for (const { slug, entry } of inCat) {
    const reasons: string[] = [];
    const br = budgetReason(entry.price, prefs.budget);
    if (br) reasons.push(br);
    const pr = platformReason(entry.platforms, prefs.plat);
    if (pr) reasons.push(pr);

    if (reasons.length > 0) {
      blocked.push({ slug, entry, reasons });
    } else {
      passed.push({
        slug,
        entry,
        score: scoreEntry(entry, prefs.taste, ctx.basisDay, ctx.catalogSize ?? DECIDE_CATALOG_SIZE),
      });
    }
  }

  // 排序第一关键字是「**主分类**是不是这个场景」，之后才是分数。
  //
  // 为什么：一个工具可以同时挂在 3 个分类下（Venice.ai 是聊天/图像/视频三条
  // 都挂），而目录里的第一个分类才是它的「主业」。只按分数排时，「做视频」
  // 的第三名可能是主做聊天、顺带挂了个视频标签的工具 —— 那不是错的推荐，
  // 而是**弱的推荐**，一次就够毁掉「这站懂行」的印象。
  // 这条规则同时是可解释的：页面上写「主分类命中优先，再补只挂靠这一类的」。
  //
  // 之后才是：分数降序 → 目录排位升序 → slug（最后那层只为「同一输入永远
  // 同一顺序」，正常情况下 order 互不相同）。
  passed.sort((a, b) => {
    const pa = a.entry.cats[0] === task.category ? 1 : 0;
    const pb = b.entry.cats[0] === task.category ? 1 : 0;
    if (pb !== pa) return pb - pa;
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.order !== b.entry.order) return a.entry.order - b.entry.order;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  // 反推荐取「目录排位靠前」的，不是「分数最低」的：读者最可能自己撞见
  // 那几个（分类页第一屏就是它们），告诉他为什么被筛掉比再列两个冷门更有用。
  blocked.sort((a, b) => {
    if (a.entry.order !== b.entry.order) return a.entry.order - b.entry.order;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  const picks = passed.slice(0, 3);
  const rejects = blocked.slice(0, 2);

  // 空结果时才给放宽出口；有结果时按钮是噪音。
  const isEmpty = picks.length === 0;
  let relaxPlatform = false;
  let relaxBudget = false;
  if (isEmpty) {
    if (prefs.plat !== 'any') {
      relaxPlatform = inCat.some(
        ({ entry }) =>
          matchesBudget(entry.price, prefs.budget) && matchesPlatform(entry.platforms, 'any'),
      );
    }
    if (prefs.budget !== 'any') {
      const looser: BudgetId = prefs.budget === 'free' ? 'free-tier' : 'any';
      relaxBudget = inCat.some(
        ({ entry }) =>
          matchesBudget(entry.price, looser) && matchesPlatform(entry.platforms, prefs.plat),
      );
    }
  }

  return {
    task,
    inCategory: inCat.length,
    matched: passed.length,
    // 推荐与反推荐不可能重叠：一个通过了全部硬筛、一个至少挂了一条。
    // 所以这里不需要再去重；将来若改了硬筛语义，`tests/decide.test.mjs`
    // 的「三个 pick 不重复」与「反推荐不在推荐里」两条会先红。
    picks,
    rejects,
    relaxable: { platform: relaxPlatform, budget: relaxBudget },
    empty: isEmpty,
  };
}

/** 「这一类里有多少个工具我们写过判断」—— 任务 chip 右侧的数字。 */
export function countByTask(entries: DecideEntries): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of DECIDE_TASKS) counts[task.id] = 0;
  for (const slug of Object.keys(entries)) {
    const e = entries[slug];
    if (!e) continue;
    for (const task of DECIDE_TASKS) {
      if (e.cats.includes(task.category)) counts[task.id] += 1;
    }
  }
  return counts;
}

/** 名字归一化 —— 与 `lib/compare.ts` 的 `normalizeName` 必须一致（见下方闸门说明）。 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_·.]+/g, '');
}

/** 两个名字是不是同一个产品的两个收录条目（互相包含即算）。 */
export function namesOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

/**
 * 这两个工具**是否真的有** `/compare/{a}-vs-{b}` 页面。
 *
 * 为什么要在这里重算一遍而不是「有 `vs` 就渲染按钮」：`vs` 只是**必要条件**。
 * `/compare/[slug]` 的 `generateStaticParams()` 走 `lib/compare.ts` 的
 * `comparePairs()`，它另外还有三道闸门 —— 对方也要有判断、同分类、
 * 不是同一产品的两个收录条目。实测 363 条里 19 条的 `vs` 指向的组合**没有
 * 页面**（4 组是同一产品、其余跨分类或对方没判断）。照着 `vs` 拼 URL 会
 * 得到 19 个 404，而这正是静态导出最容易漏掉的一类断链。
 *
 * 返回 `null` 表示没有页面；否则返回 `{a}-vs-{b}`（**目录序在前的那个在前**，
 * 与 `comparePairs` 的无向去重规则一致）。
 */
export function comparePairSlug(
  a: string,
  b: string,
  entries: DecideEntries,
): string | null {
  if (!a || !b || a === b) return null;
  const ea = entries[a];
  const eb = entries[b];
  if (!ea || !eb) return null;
  if (ea.vs !== b && eb.vs !== a) return null;
  if (!ea.cats.some((c) => eb.cats.includes(c))) return null;
  if (namesOverlap(ea.name, eb.name)) return null;
  const first = ea.order <= eb.order ? a : b;
  const second = first === a ? b : a;
  return `${first}-vs-${second}`;
}

/** 卡片底部「vs X 对比」的 href；没有对应页面时返回 null（按钮不渲染）。 */
export function compareHref(slug: string, entries: DecideEntries): string | null {
  const entry = entries[slug];
  if (!entry?.vs) return null;
  const pair = comparePairSlug(slug, entry.vs, entries);
  return pair ? `/compare/${pair}` : null;
}

/**
 * URL → 条件。脏值一律落回默认（默认值不写进 URL，见 `buildDecideQuery`）。
 *
 * 入参是 `location.search`（带不带前导 `?` 都行）。
 */
export function parseDecideParams(search: string): DecidePrefs {
  const qs = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(qs);

  const task = taskById(params.get('task'))?.id ?? null;

  const budgetRaw = params.get('budget');
  const budget: BudgetId =
    budgetRaw === 'free' || budgetRaw === 'free-tier' || budgetRaw === 'any'
      ? budgetRaw
      : DECIDE_DEFAULTS.budget;

  const platRaw = params.get('plat');
  const plat: PlatformId = DECIDE_PLATFORMS.some((p) => p.id === platRaw)
    ? (platRaw as PlatformId)
    : DECIDE_DEFAULTS.plat;

  const tasteRaw = params.get('taste');
  const taste: TasteId = DECIDE_TASTES.some((t) => t.id === tasteRaw)
    ? (tasteRaw as TasteId)
    : DECIDE_DEFAULTS.taste;

  return { task, budget, plat, taste };
}

/**
 * 条件 → 查询串。**默认值不写**（`?task=` 为空串），所以「分享出去的链接」
 * 只包含用户真的改过的东西，同一组条件在任何一个默认态页面里都长得一样。
 */
export function buildDecideQuery(prefs: DecidePrefs): string {
  const parts: string[] = [];
  if (prefs.task) parts.push(`task=${encodeURIComponent(prefs.task)}`);
  if (prefs.budget !== DECIDE_DEFAULTS.budget) parts.push(`budget=${prefs.budget}`);
  if (prefs.plat !== DECIDE_DEFAULTS.plat) parts.push(`plat=${prefs.plat}`);
  if (prefs.taste !== DECIDE_DEFAULTS.taste) parts.push(`taste=${prefs.taste}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
