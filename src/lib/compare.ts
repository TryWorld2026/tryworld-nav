/**
 * 二选一对比的预置清单 —— **从数据算出来的，不是手挑的**。
 *
 * 为什么需要 `/compare`：审计里最扎心的一条是「能找到工具，但选不出工具」。
 * 详情页的「怎么选」回答了「这个工具适合我吗」，但读者的真实问题是
 * 「这两个我该选哪个」—— 那需要**并排**看，而不是读完 A 页再读 B 页。
 * 竞品里唯一正面解决这件事的形态就是预置对比。
 *
 * ## 清单口径：用「读者关心度」，不用「原站推荐」
 *
 * 第一版曾拿 `tool-extras.json` 的 `related` 双向共现当主信号 —— 那是错的：
 * 那个字段是爬虫从原站抓的**自动推荐**，2080 条全都填了 6 个、权重完全一样，
 * 它度量的是「原站算法把这两个放一起」，不是「读者真的在比」。按它排出来的
 * 前 7 组全是冷门工具，做成页面没人会点。
 *
 * 现在的主信号是「读者关心度」：
 *   - 首页 5 个常用推荐（读者最可能拿来当基准）→ 重加权
 *   - 编辑集合成员（被人工挑过的工具）→ 中加权，且封顶
 *   - **两边都有人工判断** → 重加权（compare 页的价值就是并排放判断）
 *   - 同分类 → **门槛**（跨分类的对比对读者没意义）
 *   - `related` 互指 → 只作加分项
 *
 * ## 三层结构：事实是骨架，判断是加层
 *
 * 实测填充率（全 2081 条）：`updated` 100% / `categories` 100% /
 * `price` 97.4% / `platforms` 72.7%；而人工判断只有 17.4%。
 * 所以 compare 页的主结构**不能**是「两块编辑判断并排」—— 那只有 176 对
 * 能看，其余要么空白要么报错。正确的是：
 *
 *   1. 顶部结构化事实表（任何一对都能渲染）
 *   2. 中部差异高亮（只标「两边不同」的行 —— 读者要的是「差在哪」）
 *   3. 底部编辑判断并排（有则并排、单边有则单边 + 另一边如实说没有、
 *      都没有则整块不渲染，与详情页 `ToolVerdict` 同一条纪律）
 *
 * ## URL 与 canonical
 *
 * `{a}-vs-{b}`，a 的目录序在前，所以 `a-vs-b` 与 `b-vs-a` 生成**同一个 URL**
 * —— 否则 2081² 的排列会让 sitemap 爆炸。预置清单只是「入口」，不预渲染
 * 全部组合。
 *
 * 本模块**零 import**：它要能被 `node --test` 直接 import（Node 原生 TS 解析
 * 要求相对 import 带扩展名，而 TSC 的 bundler 解析不接受 `.ts` 后缀）。
 * 所以判断数据由调用方传入，而不是这里 import `tool-verdicts`。
 * 这与 `lib/search.ts` / `lib/card-sort.ts` 是同一条约束。
 */

/** 一组对比。两个 slug 都保证有判断数据。 */
export type ComparePair = {
  /** URL 段：`{a}-vs-{b}`，a 的目录序在前。 */
  slug: string;
  a: string;
  b: string;
  /**
   * 读者关心度得分。用来给清单排序；不是「互指次数」，所以页面上不展示
   * 具体数字（展示一个内部评分对读者没有意义）。
   */
  score: number;
  /** 两边是否都有人工判断 —— 决定 compare 页底部那一层能不能并排。 */
  bothJudged: boolean;
};

/** 判断数据的最小形状。`VERDICTS` 结构上满足它。 */
export type VerdictIndex = Record<string, { vs?: string } | undefined>;

/**
 * 归一化工具名，用于挡住「同一个产品的两个收录条目」。
 *
 * 实测（2026-10-22）有 4 组 `vs` 是同一产品的不同收录条目，不是二选一：
 * `AIPPT ↔ 360 AI PPT`、`AIPPT ↔ WPS AI PPT`、`iSlide AIPPT ↔ AIPPT`、
 * `豆包 ↔ 豆包手机助手`。读者搜「AIPPT」看到「AIPPT 还是 360 AI PPT？」，
 * 点进去发现是同一类东西 —— 那不是「帮他在两者间选」，是**让他怀疑我们
 * 收录重复了**。
 *
 * 判据：两个名字归一化后**存在包含关系**就不是二选一。
 * 去掉空格/连字符/下划线、转小写，中文不做分词（「豆包」⊂「豆包手机助手」
 * 正好被这条抓住）。
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_·.]+/g, '');
}

/** 这两个名字看起来是不是同一个产品（互相包含）。 */
export function namesOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

/** 排序与评分需要的目录信息。由调用方传入（目录序在 `lib/data.ts` 里）。 */
export type CompareContext = {
  /** slug → 目录序号。 */
  order: Map<string, number>;
  /** slug → 分类 slug 数组（同分类是门槛）。 */
  categories: Map<string, string[]>;
  /** slug → 显示名。用来挡「同一个产品的两个收录条目」（见 `namesOverlap`）。 */
  names?: Map<string, string>;
  /** 首页常用推荐的 slug（重加权）。 */
  featured?: Set<string>;
  /** slug → 被多少个编辑集合收录（中加权，封顶 3）。 */
  collectionCount?: Map<string, number>;
  /** slug → `related` 里出现的 slug 集合（只作加分项）。 */
  related?: Map<string, Set<string>>;
};

/** 权重 —— 数字本身就是这套口径的文档，改动前先读上面的说明。 */
const W = {
  /** 首页推荐：读者最可能拿来当基准。 */
  featured: 60,
  /** 被编辑集合收录，每个 +18，封顶 3 个（再多也不加，避免集合大的工具通吃）。 */
  collectionEach: 18,
  collectionCap: 3,
  /** 两边都有人工判断：compare 页的核心价值。 */
  bothJudged: 50,
  /** `related` 互指：只作加分项，权重必须低于上面任何一条。 */
  related: 25,
} as const;

/**
 * 全部可选对比对，按读者关心度降序。
 *
 * ## 硬门槛：必须有**人工写下的 `vs` 关联**
 *
 * 这是本模块最重要的一个决定，也是实测踩出来的：
 *
 * 只用「同分类 + 两边都有判断」当门槛时，排出来的第一名是
 * **「Lovart vs Seko AI」** —— 一个是设计工具、一个是视频工具，它们确实
 * 共享一个分类标签，但**不是读者会二选一的两个东西**。共享分类是必要
 * 条件，远不是充分条件。
 *
 * 唯一能证明「这两个是真正的替代关系」的信号，是 `tool-verdicts.ts` 里
 * 有人**亲手写下**的 `vs` 字段 —— 编辑写「与 X 相比强在…弱在…」时，他已经
 * 判断过这两个是可比的了。所以 `vs` 是**语义闸门**，而
 * featured / collections / bothJudged 只负责**在闸门之内排序**。
 *
 * 注意与 `related` 的区别：`related` 是爬虫从原站抓的**自动推荐**
 * （2080 条全都 6 个、权重一样），它不代表任何人判断过这两个可比。
 * `vs` 是人工字段，`related` 不是 —— 这是两者唯一但决定性的差别。
 *
 * 代价是清单规模从 1030 对降到几十对。这**不是缺点**：对比页的价值在
 * 「我们替你挑出了最值得比的那些」，而不是「任意两个都能比」——后者是
 * `/tools` 已经做过的事，而且没有人工判断的组合做成页面只剩两张卡并排。
 */
export function comparePairs(
  verdicts: VerdictIndex,
  ctx: CompareContext,
): ComparePair[] {
  const pairs: ComparePair[] = [];
  const seen = new Set<string>();

  const ord = (s: string) => ctx.order.get(s) ?? Number.MAX_SAFE_INTEGER;
  const catsOf = (s: string) => ctx.categories.get(s) ?? [];
  const collCount = (s: string) => Math.min(ctx.collectionCount?.get(s) ?? 0, W.collectionCap);

  /** 是否有人工写下的双向或单向 `vs` 关联。 */
  const hasVsLink = (x: string, y: string) =>
    verdicts[x]?.vs === y || verdicts[y]?.vs === x;

  const judged = Object.keys(verdicts).filter((s) => verdicts[s]);

  for (const x of judged) {
    for (const y of judged) {
      if (x === y) continue;
      // 无向去重：只处理目录序在前的那个方向，保证一个组合只产出一条。
      if (ord(x) > ord(y)) continue;
      const key = `${x}\u0000${y}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // **硬门槛 1**：必须有人工 `vs` 关联（见函数注释）。
      if (!hasVsLink(x, y)) continue;

      // **硬门槛 2**：同分类。跨分类的二选一对读者没有意义
      // （「用 Notion 还是用 Midjourney」不是问题）。
      const cx = new Set(catsOf(x));
      if (!catsOf(y).some((c) => cx.has(c))) continue;

      // **硬门槛 3**：不是同一个产品的两个收录条目（见 `namesOverlap`）。
      const nx = ctx.names?.get(x);
      const ny = ctx.names?.get(y);
      if (nx && ny && namesOverlap(nx, ny)) continue;

      let score = W.bothJudged;
      if (ctx.featured?.has(x)) score += W.featured;
      if (ctx.featured?.has(y)) score += W.featured;
      score += collCount(x) * W.collectionEach;
      score += collCount(y) * W.collectionEach;
      // `related` 互指只加分：原站推荐不是读者关心度，见文件头。
      const rx = ctx.related?.get(x);
      const ry = ctx.related?.get(y);
      if (rx?.has(y) || ry?.has(x)) score += W.related;

      pairs.push({ slug: `${x}-vs-${y}`, a: x, b: y, score, bothJudged: true });
    }
  }

  return pairs.sort((p, q) => {
    if (q.score !== p.score) return q.score - p.score;
    const dp = ord(p.a) + ord(p.b);
    const dq = ord(q.a) + ord(q.b);
    if (dp !== dq) return dp - dq;
    return p.slug < q.slug ? -1 : p.slug > q.slug ? 1 : 0;
  });
}

/**
 * 从预置清单里挑出**互不重叠**的前 N 组 —— 用于 `/compare` 总览页的
 * 「最值得看的几组」。
 *
 * 为什么要求互不重叠：同一个工具连出现三次（比如 Lovart 同时对比
 * 哩布哩布、即梦、堆友），读者会以为我们只有这一个工具。
 */
export function pickDistinctPairs(pairs: ComparePair[], count: number): ComparePair[] {
  const used = new Set<string>();
  const out: ComparePair[] = [];
  for (const p of pairs) {
    if (used.has(p.a) || used.has(p.b)) continue;
    used.add(p.a);
    used.add(p.b);
    out.push(p);
    if (out.length >= count) break;
  }
  return out;
}
