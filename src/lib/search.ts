/**
 * 站内搜索 —— **纯函数、零依赖**，故意不做任何 import。
 *
 * 为什么要在意「零依赖」：
 *   1. 它被客户端组件（`command-dialog.tsx`）使用，跑在浏览器里；
 *   2. 它被 node 测试直接 import（`node --test tests/search.test.mjs`，
 *      Node 24 原生解析 `.ts`），所以不能悄悄拖进 14 MB 数据；
 *   3. 它是「用户问法 → 站内说法」唯一的翻译层，必须能被单独断言。
 *
 * 历史包袱：原实现（`lib/data.ts` 的 `searchTools`）是纯小写子串匹配，
 * 于是「写代码」0 命中而「代码」202 命中 —— 供给够、入口断。这里做了三件事：
 *
 *   1. **意图展开**（`INTENTS`）：把「写代码」翻译成 代码/编程/开发/补全…；
 *   2. **关键词字段**（索引里的 `k`）：工具正文里出现过的任务词，让
 *      「AI 代码补全」这类正文表述能命中「写代码」，而不必改 2081 条数据；
 *   3. **稳定的评分与排序**：名称全等 > 前缀 > 名称含 > 关键词 > 简介 >
 *      分类 > 标签；同分按名称短者优先，再按索引顺序，保证「同一查询永远
 *      同样顺序」。
 *
 * 不做的：拼音、模糊纠错、向量检索。它们会引入依赖或不可解释的排序，
 * 而这个站点要的是「能搜到、结果稳定」。
 */

/**
 * 任务词与意图映射。
 *
 * 为什么内联在这个文件里而不是拆一个 `search-lexicon.ts`：Node 的原生 TS
 * 解析（`node --test tests/search.test.mjs` 直接 import 本文件）**要求相对
 * import 写扩展名**，而 Next/TSC 的 `moduleResolution: bundler` 又不接受
 * `./search-lexicon.ts` 这种写法。两边都要成立，最省事且最不容易被后人改坏
 * 的做法就是让本文件零 import —— 它也确实是「用户问法 → 站内说法」唯一的
 * 翻译层，独立成模块并无额外收益。
 *
 * `intents`：把「用户怎么问」映射到「站内怎么写」，供 `expandQuery()` 展开。
 * `LEXICON`：高频任务词，由 `scripts/generate-search-index.mjs` 解析（它用
 * 正则抽 `export const LEXICON` 里的字符串字面量），给每个工具的正文打关键词。
 *
 * 维护约定：
 *   - `intents` 的键必须是**用户会输入的原话**（动词 + 宾语），不要写成行话；
 *   - 值是站内数据里真正出现过的词，宁少勿滥；
 *   - `LEXICON` 里**不要加「AI」「工具」「平台」这类每个条目都有的泛词**，
 *     生成脚本还有一道 300 次的文档频次上限兜底。
 */
export const INTENTS: Record<string, string[]> = {
  写代码: ['代码', '编程', '开发', 'IDE', '补全', '代码生成'],
  做视频: ['视频', '剪辑', '动画', '短片', '视频生成'],
  // 「剪视频」不在旧键里 → 整串匹配不上任何意图，而索引的关键词只有「剪辑」，
  // 于是这个最自然的说法零结果。同一类缺口还有下面 5 个（2026-10-19 实测）。
  剪视频: ['剪辑', '视频', '视频剪辑', '短视频'],
  做表格: ['表格', 'Excel', '数据分析', '报表'],
  画图: ['绘画', '绘图', '生图', '作图', '插画'],
  写小说: ['小说', '故事', '网文', '写作'],
  做播客: ['播客', '音频', 'podcast'],
  写邮件: ['邮件', 'email', '邮件撰写'],
  爬虫: ['抓取', '采集', '爬取', '网页抓取'],
  论文润色: ['论文', '学术', '润色', '查重', '文献'],
  小红书文案: ['小红书', '文案', '笔记', '种草'],
  做网站: ['网站', '建站', '网页', '落地页', '站点'],
  电商详情页: ['电商', '详情页', '商品图', '商拍', '主图'],
  周报: ['周报', '报告', '汇报', '总结'],
  会议纪要: ['会议', '纪要', '记录', '转写'],
  抠图: ['抠图', '去背景', '透明'],
  去水印: ['水印'],
  配音: ['配音', '语音', 'TTS', '克隆'],
  数字人: ['数字人', '虚拟人', '分身'],
  PPT: ['PPT', '幻灯片', '演示'],
  翻译: ['翻译', '双语', '译'],
  简历: ['简历', '求职', '面试', 'CV'],
  合同: ['合同', '法律', '律师', '审查'],
  数据分析: ['数据', '分析', '报表', '图表'],
  思维导图: ['思维导图', '脑图', '白板'],
  提示词: ['提示词', 'prompt', '指令'],
  客服: ['客服', '机器人', '工单'],
  音乐: ['音乐', '作曲', '编曲'],
  logo: ['logo', '标志', '品牌'],
  字幕: ['字幕', '翻译字幕'],
  建模: ['建模', '3D', '模型'],
  面试: ['面试', '求职'],
  电商: ['电商', '店铺', '商品'],
};

/**
 * 任务词表：给每个工具的正文打关键词用。
 *
 * 选词标准：① 是用户会直接搜的动作词；② 在 prose 里以某个具体表述出现过；
 * ③ **有区分度** —— 在 2081 条正文里出现 300 次以上的词（营销 818、报告 655、
 * 识别 616、自动化 533…）等于「人人都有」，加进来只会把搜索变成一锅粥，
 * 也会把索引撑大。生成脚本的 `MAX_DF` 会自动剔掉它们。
 *
 * 频次（分母 2081，2026-10-18 实测）可从生成脚本的统计输出重算。
 */
export const LEXICON: string[] = [
  '代码补全', '代码生成', '代码审查', '编程', '重构', '调试',
  '视频生成', '视频剪辑', '剪辑', '动画', '短片', '字幕', '配音',
  '数字人', '虚拟人', '口播', '图生视频', '文生视频',
  '抠图', '去背景', '去水印', '修图', '扩图', '换脸', '商品图', '主图', '详情页', '商拍',
  '海报', '封面', 'logo', '标志', '品牌设计', '插画', '漫画', '表情包',
  '写文章', '长文', '文案', '小红书', '公众号', '种草', '改写', '润色', '摘要',
  '论文', '学术', '文献', '查重', '降重', '综述', '引用',
  '做网站', '建站', '落地页', '网页', '前端', '低代码', '表单',
  '周报', '月报', '汇报', '报告', 'PPT', '幻灯片', '演示', '表格', '数据分析', '报表', '图表',
  '会议', '纪要', '记录', '转写', '语音转文字', '翻译', '双语', '同传',
  '思维导图', '脑图', '白板', '流程图',
  '简历', '求职', '面试', '招聘', '合同', '法律', '律师', '合规',
  '客服', '工单', '知识库', '获客', '投放', 'SEO',
  '提示词', 'prompt', 'Agent', '智能体', '工作流', '自动化', 'RPA',
  '音乐', '作曲', '编曲', '音效', '人声分离',
  '建模', '3D', '渲染', '设计稿', 'UI', '原型',
  'OCR', '识别', '标注', '检测', '审核',
];

/** 评分权重。数值只用于排序，不对外暴露。 */
const SCORE = {
  exactName: 100,
  prefixName: 80,
  containsName: 60,
  keyword: 45,
  description: 30,
  category: 20,
  tag: 10,
} as const;

/** 别名命中的折扣：比直接用原词弱一档，避免「做视频」把所有「视频」都顶到最前。 */
const ALIAS_FACTOR = 0.9;

/** 一条索引记录。字段名短是为了把 JSON 压到 60 KB（br）以内。 */
export type SearchRecord = {
  /** slug */
  s: string;
  /** name */
  n: string;
  /** description */
  d: string;
  /**
   * icon 路径（`/assets/icons/x.png`）。
   * 必须存完整路径而不是拼接：图标有 png / jpg / jpeg / webp / svg / avif
   * 六种扩展名，硬编码 `.png` 会让 10 个 avif、64 个 webp、271 个 svg 破图。
   */
  i: string;
  /** category slugs */
  c: string[];
  /** tag names */
  t: string[];
  /** keywords harvested from prose */
  k?: string[];
};

/** 一条命中结果。 */
export type SearchHit = {
  slug: string;
  score: number;
  /** 命中的是哪个变体（原词还是别名），供 UI 提示用。 */
  matched: string;
};

/**
 * 把用户输入展开成一组检索词。
 *
 *   expandQuery('写代码') → ['写代码', '代码', '编程', '开发', 'ide', '补全', '代码生成']
 *
 * 规则：
 *   - 原词永远排第一（精确命中优先）；
 *   - 命中某个意图键（包含关系，双向）时并入该意图的全部别名；
 *   - 全部小写、去重、保序；
 *   - 空串返回空数组（调用方据此走「热门/推荐」分支）。
 */
export function expandQuery(raw: string): string[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];

  const out: string[] = [q];
  const seen = new Set(out);

  const push = (term: string) => {
    const t = term.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  for (const [intent, aliases] of Object.entries(INTENTS)) {
    const key = intent.toLowerCase();
    // 双向包含：「写代码」命中意图「写代码」；用户输入「码」不该展开整个意图，
    // 但输入「帮我写代码」应该展开。
    const hit = q === key || q.includes(key) || key.includes(q);
    if (!hit) continue;
    for (const a of aliases) push(a);
  }

  return out;
}

/** 归一化一条记录的全部可检索文本（只做一次，调用方缓存）。 */
type Prepared = {
  rec: SearchRecord;
  name: string;
  desc: string;
  cats: string[];
  tags: string[];
  keywords: string[];
  /** 索引顺序，用于同分稳定排序。 */
  order: number;
};

export function prepareIndex(records: SearchRecord[]): Prepared[] {
  return records.map((rec, order) => ({
    rec,
    order,
    name: (rec.n ?? '').toLowerCase(),
    desc: (rec.d ?? '').toLowerCase(),
    cats: (rec.c ?? []).map((s) => s.toLowerCase()),
    tags: (rec.t ?? []).map((s) => s.toLowerCase()),
    keywords: (rec.k ?? []).map((s) => s.toLowerCase()),
  }));
}

/** 单个检索词对一条记录的原始得分（0 表示没命中）。 */
function scoreOne(p: Prepared, term: string): number {
  if (p.name === term) return SCORE.exactName;
  if (p.name.startsWith(term)) return SCORE.prefixName;
  if (p.name.includes(term)) return SCORE.containsName;
  if (p.keywords.some((k) => k.includes(term) || term.includes(k))) return SCORE.keyword;
  if (p.desc.includes(term)) return SCORE.description;
  if (p.cats.some((c) => c.includes(term))) return SCORE.category;
  if (p.tags.some((t) => t.includes(term))) return SCORE.tag;
  return 0;
}

/**
 * 检索。
 *
 * @param records 由 `generate-search-index.mjs` 产出的扁平索引
 * @param query   用户原话
 * @param limit   上限（命令面板 30，`/tools` 用 Infinity）
 */
export function searchIndex(
  records: SearchRecord[],
  query: string,
  limit = 30,
): SearchHit[] {
  const terms = expandQuery(query);
  if (terms.length === 0) return [];

  const prepared = prepareIndex(records);
  const best = new Map<string, SearchHit>();

  for (const p of prepared) {
    let top = 0;
    let matched = '';

    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const raw = scoreOne(p, term);
      if (raw === 0) continue;
      // 第一个词是用户原话，不折扣；别名打折。
      const score = i === 0 ? raw : raw * ALIAS_FACTOR;
      if (score > top) {
        top = score;
        matched = term;
      }
    }

    if (top > 0) {
      best.set(p.rec.s, { slug: p.rec.s, score: top, matched });
    }
  }

  const orderOf = new Map(prepared.map((p) => [p.rec.s, p.order]));
  const nameOf = new Map(prepared.map((p) => [p.rec.s, p.name]));

  return [...best.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // 同分时短名优先（「Kimi」应该排在「Kimi PPT助手」前面）。
      const la = nameOf.get(a.slug)?.length ?? 99;
      const lb = nameOf.get(b.slug)?.length ?? 99;
      if (la !== lb) return la - lb;
      return (orderOf.get(a.slug) ?? 0) - (orderOf.get(b.slug) ?? 0);
    })
    .slice(0, limit === Number.POSITIVE_INFINITY ? undefined : limit);
}

/**
 * `/tools` 页的分类/标签过滤。与搜索分开是因为它们是**精确的集合筛选**，
 * 不该被意图展开影响（选了「AI法律助手」就是这一类，不要混进「合同」相关）。
 */
export function filterRecords(
  records: SearchRecord[],
  opts: { categories?: string[]; tag?: string; freeSlugs?: Set<string>; price?: string },
): SearchRecord[] {
  const { categories = [], tag = '', freeSlugs, price = '' } = opts;
  const catSet = new Set(categories);
  return records.filter((r) => {
    if (catSet.size > 0 && !(r.c ?? []).some((c) => catSet.has(c))) return false;
    if (tag && !(r.t ?? []).includes(tag)) return false;
    if (price === 'free' && freeSlugs && !freeSlugs.has(r.s)) return false;
    return true;
  });
}
