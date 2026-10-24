/**
 * 「为什么这条会出现」——把搜索命中依据翻成人话。
 *
 * 背景：`searchIndex()` 早就在每条结果上产出 `matchedFields`（命中字段）与
 * `matchedTerms`（实际命中的词），但界面一直只显示简介 —— 于是「搜『小红书』
 * 为什么第 2 条是个笔记工具」这类疑问，用户只能自己猜。这一层把依据摆出来：
 *
 *   因为命中：小红书 · 图文        （词 + 字段）
 *
 * 三条纪律：
 *   1. **只说检索层真的命中了什么**，不写「最符合你的需求」这类推断；
 *   2. 字段名用中文短词（名称 / 简介 / 关键词 / 分类 / 标签 / 价格 / 平台），
 *      不用 `keyword` 之类的内部名；
 *   3. 词太多时截断到 2 个 + 「等」——这一行是备注，不是正文。
 *
 * 零 import：与 `search.ts` / `card-sort.ts` / `compare.ts` 同一条约束
 * （`node --test` 直接 import，Node 原生 TS 解析不接受无扩展名的相对导入）。
 */

/** 与 `lib/search.ts` 的 `SearchField` 同值（此处独立声明，保持零 import）。 */
export type ReasonField =
  | 'name'
  | 'keyword'
  | 'description'
  | 'category'
  | 'tag'
  | 'price'
  | 'platform';

const FIELD_LABEL: Record<ReasonField, string> = {
  name: '名称',
  keyword: '关键词',
  description: '简介',
  category: '分类',
  tag: '标签',
  price: '价格',
  platform: '平台',
};

/** 字段的「强度」——命中名称比命中简介更能解释排序，用于挑主依据。 */
const FIELD_WEIGHT: Record<ReasonField, number> = {
  name: 7,
  keyword: 6,
  tag: 5,
  category: 4,
  description: 3,
  platform: 2,
  price: 1,
};

/** 最多显示几个命中词。 */
export const REASON_MAX_TERMS = 2;

/**
 * 命中词与用户原话相同 → 这条依据没有新信息（30 条结果会写 30 遍同一句）。
 * 此时改说「命中在哪」（简介 / 关键词 / 分类…），相邻行才会因为字段不同而区分开。
 */
function normalizeTerm(t: string): string {
  return t.trim().toLowerCase();
}

export type SearchReason = {
  /** `因为命中：小红书 · 图文` 里的「小红书 · 图文」；空串表示没有可说的依据。 */
  terms: string;
  /** 主依据字段的中文名（名称 / 关键词 / 分类…）；没有依据时为 `null`。 */
  field: string | null;
  /** 一行完整文案；没有依据时返回空串，调用方据此退回简介。 */
  line: string;
};

/**
 * 把一条命中翻成「因为命中：词 · 字段」。
 *
 * 输入来自搜索结果（可能是 `undefined` 字段：真实数据里没有关键词的工具
 * 也可能命中简介），所以每个字段都要能缺。
 */
export function searchReason(
  hit: {
    matchedFields?: ReasonField[];
    matchedTerms?: string[];
  },
  /**
   * 用户输入的原始查询。给了它，函数就能判断「命中的词是不是用户自己打的」——
   * 是的话这条依据只是复读，应改说命中字段；不是的话（同义展开命中）才值得展示。
   */
  query?: string,
): SearchReason {
  const terms = (hit.matchedTerms ?? []).filter((t) => typeof t === 'string' && t.trim());
  const fields = (hit.matchedFields ?? []).filter((f) => f in FIELD_WEIGHT);

  if (terms.length === 0 && fields.length === 0) {
    return { terms: '', field: null, line: '' };
  }

  // 主依据取「最强的那一个字段」，不是第一个 —— matchedFields 的注释说它
  // 已按强度排序，但真数据里仍出现过 category 排在 name 前面的情况。
  const main = fields.slice().sort((a, b) => FIELD_WEIGHT[b] - FIELD_WEIGHT[a])[0] ?? null;

  const mainLabel = main ? FIELD_LABEL[main] : null;

  // 命中的词里，剔除「就是用户输入的那句」的那些 —— 剩下的才有解释力
  // （来自 INTENTS / CONCEPTS 的同义展开，比如搜「剪视频」命中「视频剪辑」）。
  const q = query ? normalizeTerm(query) : '';
  const informative = q ? terms.filter((t) => normalizeTerm(t) !== q) : terms;

  if (informative.length > 0) {
    const shown = informative.slice(0, REASON_MAX_TERMS).join(' · ');
    const more = informative.length > REASON_MAX_TERMS ? ' 等' : '';
    const termText = `${shown}${more}`;
    return {
      terms: termText,
      field: mainLabel,
      // 名称命中是唯一不需要补字段名的情况（「因为命中：小红书」已经够清楚）；
      // 关键词 / 简介 / 分类 / 标签 / 平台 都把字段写出来，读者才知道命中在哪。
      line: mainLabel && main !== 'name'
        ? `因为命中${mainLabel}：${termText}`
        : `因为命中：${termText}`,
    };
  }

  // 只有用户原话命中：
  //   · 命中在「名称」→ 说一句「因为命中名称」意义也不大，直接退回简介；
  //   · 命中在关键词/简介/分类等 → 说「命中在哪」仍有点信息量，保留。
  // 这一条是实测修出来的：搜「小红书」时前 5 条全是「因为命中关键词」，
  // 整列一模一样，等于没有解释，还把本来能区分工具的简介挤掉了。
  if (mainLabel && main !== 'name') {
    return { terms: '', field: mainLabel, line: `因为命中${mainLabel}` };
  }
  if (mainLabel === '名称') {
    // 名称命中且词就是原话：每个工具都被标一遍「命中名称」仍然没有区分度，
    // 所以**不出文案**（交给简介），但 `field` 仍如实回报 —— 调用方可能想
    // 用它做排序解释或埋点，扔掉就等于谎报「没有依据」。
    return { terms: '', field: mainLabel, line: '' };
  }

  const shown = terms.slice(0, REASON_MAX_TERMS).join(' · ');
  return { terms: shown, field: null, line: shown ? `因为命中：${shown}` : '' };
}
