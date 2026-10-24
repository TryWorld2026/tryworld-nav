/**
 * 「我的工具栈」的导出与对比 —— **纯函数、零 import**。
 *
 * 为什么必须零 import：它被 `node --test tests/stack-export.test.mjs` 直接
 * import。Node 的原生 TS 解析要求相对 import 带扩展名，而 TSC 的
 * `moduleResolution: bundler` 又不接受 `.ts` 后缀 —— 两边都要成立，唯一的
 * 做法就是让被测试的文件零依赖，需要的数据由调用方传入。这与
 * `lib/search.ts` / `lib/card-sort.ts` / `lib/compare.ts` 是同一条约束。
 *
 * 因此这里**不做任何取数**：分类名、价格档文案、「2025 年 8 月更新」这种
 * 时间文案、以及「收录快照是否超过一年」全部由调用方算好再传进来。
 * 这样这一层能被单测覆盖（不依赖 `data/*.json`），也顺带保证「导出这件事」
 * 不跟 `Date.now()` 绑在一起 —— 导出内容只由用户此刻的收藏决定。
 *
 * 三条底线（改这个文件之前先读一遍）：
 *   1. **只写事实与判断原文**。没有的判断写 `未写判断`，没有的价格写
 *      `判断里未写价格`，缺采集数据写 `—`。留空、填「暂无数据」、或者
 *      替用户推断一句「适合你」，都比不写更伤信任。
 *   2. **分类分组顺序 = 收藏顺序**。收藏页按加入时间倒序，导出也照旧，
 *      读者不需要在 Markdown 里重新找一遍自己刚才看的位置。
 *   3. **输出是确定的**。同一份输入永远得到同一份字节 —— 纯静态导出要求
 *      「没改内容就一个字节都不变」（见 `catalog-index.ts` 的 `DATA_EPOCH`
 *      说明），导出内容也不能出现随渲染时刻漂移的东西。
 */

/** 栈里的一条工具 —— 事实 + 判断原文，全部已水化。 */
export type StackTool = {
  slug: string;
  name: string;
  /** 主分类名；空串表示索引里也没有分类，导出时归入 `未分类`。 */
  category: string;
  /** 价格档展示文案（如「免费增值」）；空串 = 站内没有采集到这一档。 */
  price: string;
  /** 免费额度（判断原文，如「免费版可聊天与读文件」）；空串 = 判断里没写。 */
  freeQuota: string;
  /** 起价展示文案（如「$20 / 月」）；空串 = 判断里没写。 */
  fromPrice: string;
  /** 平台名（`Web` / `iOS` / `微信小程序`…）；空数组 = 未采集到。 */
  platforms: string[];
  /** 收录更新展示文案（如「2025 年 8 月更新」）；空串 = 未采集到。 */
  updated: string;
  /** 编辑判断·适合；空数组 = 没写过判断。 */
  bestFor: string[];
  /** 编辑判断·不适合。 */
  notFor: string[];
  /** 与同类差异（一句话）；空串 = 没有。 */
  diff: string;
  /** 站内详情页绝对地址（`SITE.url` + `/tools/{slug}`）。 */
  url: string;
  /** 收录快照是否已超过一年 —— 由调用方用 `DATA_EPOCH` 判定，不用墙钟。 */
  stale: boolean;
};

/** 导出头部需要的两件事：日期（`YYYY-MM-DD`，北京时间）与站名。 */
export type StackMeta = {
  /** `YYYY-MM-DD`。调用方按 `Asia/Shanghai` 算好，这里不做时区换算。 */
  date: string;
  /** 站名，默认「试界导航」。 */
  siteName?: string;
};

/** 收藏顺序里没有分类的条目归到这一组。 */
export const UNCATEGORIZED = '未分类';

/** 多值事实的连接符。对比表与导出共用，UI 依赖它把单元格拆成行。 */
export const LIST_SEP = ' / ';

/** 缺采集数据时的占位。与 `/compare` 页一致：缺失如实显示 `—`，不推测。 */
export const DASH = '—';

/** 完全没有编辑判断时的单元格文案。 */
export const NO_VERDICT = '未写判断';
/** 有判断、但判断里没写价格事实。 */
export const NO_PRICE = '判断里未写价格';
/** 有判断、但判断里没写「适合」。 */
export const NO_BEST = '判断里未写适合';
/** 有判断、但判断里没写「不适合」。 */
export const NO_NOT_FOR = '判断里未写不适合';
/** 有判断、但判断里没写「与同类差异」。 */
export const NO_DIFF = '判断里未写同类差异';

/**
 * 这条工具到底有没有编辑判断。
 *
 * 判据是「有没有任何一条人工写下的字段」，而不是「bestFor 非空」——
 * 有一类条目只写了不适合或只写了差异，把它算成「没判断」会让对比表对同一
 * 个工具同时显示「未写判断」和一条差异，自相矛盾。
 */
export function hasVerdict(t: {
  bestFor?: string[];
  notFor?: string[];
  diff?: string;
  freeQuota?: string;
  fromPrice?: string;
}): boolean {
  return Boolean(
    (t.bestFor && t.bestFor.length > 0) ||
      (t.notFor && t.notFor.length > 0) ||
      t.diff ||
      t.freeQuota ||
      t.fromPrice,
  );
}

/** 把一条工具渲染成「免费增值 · Web · 2025 年 8 月更新」这一段，空值自动省略。 */
function factLine(t: StackTool): string {
  return [t.price, t.platforms.filter(Boolean).join('、'), t.updated]
    .filter(Boolean)
    .join(' · ');
}

/**
 * 分类分组。
 *
 * `Map` 的插入顺序就是「这个分类第一次出现的顺序」= 收藏顺序（新的在最前），
 * 组内也保持传入顺序。不排序：读者刚在页面上看到「可灵在最上面」，导出件里
 * 它就应该还在最上面。
 */
function groupByCategory(tools: StackTool[]): { category: string; tools: StackTool[] }[] {
  const map = new Map<string, StackTool[]>();
  for (const t of tools) {
    const key = t.category || UNCATEGORIZED;
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  return Array.from(map.entries(), ([category, list]) => ({ category, tools: list }));
}

/**
 * 一条工具的正文行（Markdown / 纯文本共用）。
 *
 * `markdown` 只影响加粗与两空格缩进：纯文本里 `**` 会原样出现，黏在名字上
 * 很难看，而缩进在纯文本里没有意义。
 */
function bulletLines(t: StackTool, markdown: boolean): string[] {
  const facts = factLine(t);
  const name = markdown ? `**${t.name}**` : t.name;
  // 名称与事实之间是 ` — `（em dash，与页面上的卡片一致）；没有事实就不留孤零零的破折号。
  const lines = [`- ${name}${facts ? ` — ${facts}` : ''}`];
  // 续行统一缩进两格：Markdown 里这是列表项内容，纯文本里读起来也是「跟着上一条」。
  const pad = '  ';
  if (t.bestFor.length > 0) lines.push(`${pad}适合：${t.bestFor.join(LIST_SEP)}`);
  if (t.notFor.length > 0) lines.push(`${pad}不适合：${t.notFor.join(LIST_SEP)}`);
  if (t.diff) lines.push(`${pad}与同类差异：${t.diff}`);
  lines.push(`${pad}${t.url}`);
  return lines;
}

/**
 * 生成「我的 AI 工具栈」的 Markdown。
 *
 * 结构刻意与示例一致（标题 / 一句来源 / 按分类分组 / 每条一个链接），
 * 因为它的下一步是贴进笔记、群聊或文档里 —— 越少修饰越不容易被渲染坏：
 *
 * ```
 * # 我的 AI 工具栈
 * > 来自试界导航 · 2026-10-23 · 共 5 个工具
 *
 * ## AI视频/动画
 * - **可灵 AI** — 免费增值 · Web · 2025 年 8 月更新
 *   适合：中文语义镜头控制 / 短视频出片
 *   https://nav.tryworld.com.cn/tools/kling
 * ```
 *
 * 没有判断的工具**不写空的「适合：」行**：那会让读者以为我们写了但内容丢了。
 * 缺事实的字段直接不出现（而不是 `—`）—— 导出件是给人读的，不是数据表。
 */
export function buildStackMarkdown(tools: StackTool[], meta: StackMeta): string {
  const site = meta.siteName ?? '试界导航';
  const lines = ['# 我的 AI 工具栈', `> 来自${site} · ${meta.date} · 共 ${tools.length} 个工具`];
  for (const group of groupByCategory(tools)) {
    lines.push('', `## ${group.category}`);
    for (const t of group.tools) lines.push(...bulletLines(t, true));
  }
  return lines.join('\n') + '\n';
}

/**
 * 生成同一份内容的**纯文本**版（贴进微信、邮件、工单时不带 Markdown 标记）。
 *
 * 分类用 `【】` 而不是 `##`：纯文本里 `##` 会被当成乱码般的符号，而 `【】`
 * 在中文语境下天然是「标题」。
 */
export function buildStackPlainText(tools: StackTool[], meta: StackMeta): string {
  const site = meta.siteName ?? '试界导航';
  const lines = ['我的 AI 工具栈', `来自${site} · ${meta.date} · 共 ${tools.length} 个工具`];
  for (const group of groupByCategory(tools)) {
    lines.push('', `【${group.category}】`);
    for (const t of group.tools) lines.push(...bulletLines(t, false));
  }
  return lines.join('\n') + '\n';
}

/**
 * 下载文件名。
 *
 * 用 ASCII 前缀而不是中文名：部分系统的下载目录会把中文文件名转义成
 * `%E6%88%91…`，用户拿到的是一串看不懂的东西。日期在后，同名文件按时间
 * 自然区分，不会互相覆盖。
 */
export function stackFileName(date: string, ext = 'md'): string {
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'md';
  return `tryworld-stack-${date}.${safeExt}`;
}

/** 对比表的九个可比较事实 —— 顺序即渲染顺序，也是「读者关心度」的顺序。 */
export const STACK_COMPARE_ROWS: readonly { key: StackCompareKey; label: string }[] = [
  { key: 'category', label: '分类' },
  { key: 'price', label: '价格档' },
  { key: 'freeQuota', label: '免费额度' },
  { key: 'fromPrice', label: '起价' },
  { key: 'platforms', label: '平台' },
  { key: 'updated', label: '最近收录更新' },
  { key: 'bestFor', label: '编辑判断·适合' },
  { key: 'notFor', label: '编辑判断·不适合' },
  { key: 'diff', label: '与同类差异' },
];

export type StackCompareKey =
  | 'category'
  | 'price'
  | 'freeQuota'
  | 'fromPrice'
  | 'platforms'
  | 'updated'
  | 'bestFor'
  | 'notFor'
  | 'diff';

/** 一行对比数据：`cells[i]` 对应 `tools[i]`，长度恒等于工具数。 */
export type StackCompareRow = {
  key: StackCompareKey;
  label: string;
  cells: string[];
};

/**
 * 把 2–4 个工具铺成对比行。
 *
 * 三点取舍写死在下面，因为它们决定了这张表诚不诚实：
 *
 *   1. **固定行序**。行序是常量（`STACK_COMPARE_ROWS`），不按工具数或选中
 *      顺序变化 —— 换了对比对象，眼睛还在同一行找到「价格档」。
 *   2. **判断缺位写「未写判断」而不是空**。空格子会被读成「这个工具这一项
 *      是空的」，而事实是「我们没写过它的判断」。
 *   3. **不比较「谁更好」**。这里没有分数字段，也没有任何排序 —— 对比表的
 *      价值是让人自己看出差别，替用户下结论是另一件事。
 *
 * 单元格里的多值一律用 `LIST_SEP` 连接，调用方可用它把一格拆回多行。
 */
export function buildStackCompareRows(tools: StackTool[]): StackCompareRow[] {
  return STACK_COMPARE_ROWS.map(({ key, label }) => ({
    key,
    label,
    cells: tools.map((t) => compareCell(t, key)),
  }));
}

/** 单个单元格的取值。 */
function compareCell(t: StackTool, key: StackCompareKey): string {
  const judged = hasVerdict(t);
  switch (key) {
    case 'category':
      return t.category || DASH;
    case 'price':
      return t.price || DASH;
    case 'freeQuota':
      return judged ? t.freeQuota || NO_PRICE : NO_VERDICT;
    case 'fromPrice':
      return judged ? t.fromPrice || NO_PRICE : NO_VERDICT;
    case 'platforms':
      return t.platforms.filter(Boolean).join('、') || DASH;
    case 'updated':
      return t.updated || DASH;
    case 'bestFor':
      if (!judged) return NO_VERDICT;
      return t.bestFor.length > 0 ? t.bestFor.join(LIST_SEP) : NO_BEST;
    case 'notFor':
      if (!judged) return NO_VERDICT;
      return t.notFor.length > 0 ? t.notFor.join(LIST_SEP) : NO_NOT_FOR;
    case 'diff':
      if (!judged) return NO_VERDICT;
      return t.diff || NO_DIFF;
    default:
      return DASH;
  }
}

/**
 * 新鲜度体检：收录快照已超过一年的条数。
 *
 * `stale` 由调用方判定（`DATA_EPOCH - updated > 365`），这里只数数 ——
 * 页面上的那句「你收藏的 N 个里，M 个的收录快照已超过一年」必须是**事实**，
 * 不能是渲染时刻跟当前时间比出来的（那会让构建产物每天变一次）。
 */
export function countStale(tools: StackTool[]): number {
  return tools.reduce((n, t) => n + (t.stale ? 1 : 0), 0);
}

// ── 数据水化（收藏快照 + 目录事实 + 编辑判断 → StackTool）────────────────

/** 收藏存储里那一条（v1 迁移来的条目只有 slug 与兜底 name）。 */
export type StackStoredItem = {
  name: string;
  description?: string;
  icon?: string;
};

/**
 * 目录里的事实（调用方从 `cardFromRecord()` 与索引取好）。
 *
 * 空串 / 空数组 = 「站内没有这条数据」。不写 `undefined` 是为了让调用方
 * 少一层 `??` —— 水化函数会统一把缺值压成空。
 */
export type StackCatalogFacts = {
  name: string;
  description?: string;
  /** 价格档展示文案；`unrated` 档传空串。 */
  price: string;
  platforms: string[];
  /** 主分类名；没有分类传空串。 */
  categoryName: string;
  /** 已格式化的收录更新文案（如「2025 年 8 月更新」）；未采集到传空串。 */
  updated: string;
};

/** 编辑判断里这一页需要的字段（判断原文，不做任何改写）。 */
export type StackVerdictFacts = {
  bestFor: string[];
  notFor: string[];
  diff?: string;
  freeQuota?: string;
  fromPrice?: string;
};

/**
 * 合并三方数据成一条 `StackTool`。
 *
 * **一律以目录为准，回退到收藏快照**：收藏快照是「用户点收藏那一刻」的
 * 拷贝，可能已经过期（工具改名、简介重写），而 v1 迁移来的条目甚至只有
 * slug —— 名称就是 slug 本身。所以 `catalog` 在时优先它，不在时用
 * `stored` 兜底，最后才用 slug。旧数据因此能导出，而不会导出一串 slug。
 */
export function toStackTool(input: {
  slug: string;
  stored: StackStoredItem;
  catalog?: StackCatalogFacts | null;
  verdict?: StackVerdictFacts | null;
  url: string;
  stale: boolean;
}): StackTool {
  const { slug, stored, catalog, verdict, url, stale } = input;
  return {
    slug,
    name: catalog?.name || stored.name || slug,
    category: catalog?.categoryName || '',
    price: catalog?.price || '',
    freeQuota: verdict?.freeQuota || '',
    fromPrice: verdict?.fromPrice || '',
    platforms: catalog?.platforms ?? [],
    updated: catalog?.updated || '',
    bestFor: verdict?.bestFor ? [...verdict.bestFor] : [],
    notFor: verdict?.notFor ? [...verdict.notFor] : [],
    diff: verdict?.diff || '',
    url,
    stale,
  };
}
