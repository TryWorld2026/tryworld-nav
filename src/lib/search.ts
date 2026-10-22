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
 *
 * 2026-10-22 的两处结构性改动：
 *   1. **索引带筛选事实**：wire v2 解码后每条记录都有价格码、平台、更新时间
 *      与「有无官网」，`/tools` 因此不再需要服务端把 2081 个完整 Tool 打进
 *      HTML（那正是目录页首屏超 400 KB 的根因）。
 *   2. **查询可解释**：`analyzeQuery()` 把用户的话拆成「概念组」，组内 OR、
 *      组间 AND，并把 `price=` / `platform=` 这类筛选词剥出来；命中结果带
 *      `matchedFields` / `matchedTerms`，界面能回答「为什么是这几条」。
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

/**
 * 语义概念组：「一句话里同时要求好几件事」的中文查询靠子串匹配是拆不开的。
 *
 * 为什么需要它而不是把整句丢进 `INTENTS`：`INTENTS` 是**键 = 用户原话**的
 * 精确映射，「能读论文并做笔记」这种句子永远不会是任何一个键；而按空格切词
 * 对中文无效（句子里根本没有空格）。概念组补的就是这一层：命中 `when` 里的
 * 任一触发词就产出一个「组内 OR」的检索集合，并且把触发词从剩余文本里消费掉，
 * 让剩下的词继续按 `INTENTS` / 原词成组 —— 组与组之间是 AND。
 *
 * `notice` 是给用户的口径提示，只在概念真的被触发时出现（「免费可商用」的
 * 授权提醒就是这么来的），不是查询结果的装饰。
 *
 * 维护约定：`when` 按「先长后短」排列；`terms` 只写站内数据里真正出现过的说法。
 */
export type QueryConcept = {
  /** 稳定 ID，供 UI 标注命中依据与测试断言。 */
  id: string;
  /** 触发词：查询里出现任一即成组（小写子串匹配）。 */
  when: string[];
  /** 组内检索词（命中任一即算满足该组）。 */
  terms: string[];
  /** 附带的面值意图：与 URL 上的筛选取交集，而不是覆盖它。 */
  price?: PriceCode[];
  platforms?: string[];
  /** 需要向用户说明口径的提示文案。 */
  notice?: string;
};

export const CONCEPTS: QueryConcept[] = [
  {
    id: 'free-commercial',
    when: ['免费可商用', '可商用', '免费商用', '商用'],
    terms: ['免费', '开源', '商用', '授权'],
    // 「商用」不是站内价格事实，只能用「免费 / 开源」这两档近似，因此必须配
    // 一条 notice 说明口径，否则就是把未验证的授权结论卖给用户。
    price: ['fully-free', 'open-source'],
    notice: '站内价格来自采集快照，「能否商用」请以各工具官网的授权条款为准。',
  },
  {
    id: 'wechat',
    when: ['企业微信', '微信公众号', '微信公众号客服', '微信', '小程序'],
    terms: ['微信', '公众号', '小程序', '企业微信'],
  },
  {
    id: 'image-generation',
    when: ['图片生成', '图像生成', '生成图片', '生成图像', '文生图', '出图'],
    terms: ['生图', '图像', '绘画', '绘图', '插画', '图片'],
  },
  {
    id: 'paper-reading',
    when: ['读论文', '看论文', '论文解读', '论文', '文献'],
    terms: ['论文', '文献', '学术', '综述', '阅读'],
  },
  {
    id: 'note-taking',
    when: ['做笔记', '记笔记', '笔记'],
    terms: ['笔记', '记录', '摘要', '标注', '知识管理'],
  },
  {
    id: 'customer-service',
    when: ['在线客服', 'AI客服', '智能客服', '客服'],
    terms: ['客服', '机器人', '工单', '坐席'],
  },
  {
    id: 'code-writing',
    when: ['写代码', '代码开发', '编程', 'coding'],
    terms: ['代码', '编程', '开发', '补全', 'IDE'],
  },
  {
    id: 'video-editing',
    when: ['剪视频', '视频剪辑', '剪辑', '做视频', '视频生成'],
    terms: ['剪辑', '视频', '短片', '字幕'],
  },
];

/**
 * 不成组的噪音词。
 *
 * 两类：① 泛词（「AI」「工具」「平台」）—— 2081 条里几乎条条都含，作为 AND
 * 约束只会把真正相关的结果挤掉；② 中文单字（「接」「的」「能」）—— 子串匹配
 * 下命中率极高且没有区分度。只有当剥掉噪音之后还剩至少一个组时才剥，
 * 保证「图」这种单字查询仍然能搜。
 */
const NOISE_TERMS = new Set([
  'ai', 'aigc', 'app', 'web', '工具', '平台', '软件', '系统', '神器', '推荐',
  '怎么', '如何', '什么', '有哪些', '帮我', '找一个', '一个', '想要', '需要',
  '的', '了', '是', '在', '和', '与', '或', '及', '能', '会', '可以', '支持',
]);

/** 评分权重。数值只用于排序，不对外暴露。 */
const SCORE = {
  exactName: 100,
  prefixName: 80,
  containsName: 60,
  keyword: 45,
  description: 30,
  category: 20,
  tag: 10,
  // 价格与平台是「事实字段」而不是文本，命中强度必须低于标签，否则
  // 「免费」这种词会把 1800 个免费增值工具顶到真正相关的结果前面。
  price: 8,
  platform: 6,
} as const;

/** 别名命中的折扣：比直接用原词弱一档，避免「做视频」把所有「视频」都顶到最前。 */
const ALIAS_FACTOR = 0.9;

/** 价格档位。顺序固定，wire 里存的就是这个下标（0–4）。 */
export const PRICE_CODES = ['fully-free', 'open-source', 'freemium', 'paid', 'unrated'] as const;
export type PriceCode = (typeof PRICE_CODES)[number];

/**
 * 展示标签。`unrated` 故意是空串：站内没有「未知」这一档可卖，
 * 缺数据就不该渲染一枚胶囊（见目录卡片与 `sortRecords` 的置后规则）。
 */
export const PRICE_LABELS: Record<PriceCode, string> = {
  'fully-free': '免费',
  'open-source': '免费开源',
  freemium: '免费增值',
  paid: '付费',
  unrated: '',
};

/** 每一档价格可被文本命中的说法，用于「免费」这类词命中价格事实。 */
const PRICE_TERMS: Record<PriceCode, string[]> = {
  'fully-free': ['免费', 'free'],
  'open-source': ['免费开源', '开源', 'open source'],
  freemium: ['免费增值'],
  paid: ['付费', '收费', '订阅', 'paid'],
  unrated: [],
};

/** icon 扩展名单字母 → 真实扩展名（wire 里只存一个字母，见生成脚本）。 */
const ICON_EXT: Record<string, string> = {
  p: 'png',
  j: 'jpg',
  s: 'svg',
  e: 'jpeg',
  w: 'webp',
  v: 'avif',
};

/**
 * 一条索引记录。字段名短是为了把 JSON 压到预算以内；wire 里的 ID／bitmask
 * 由 `decodeSearchIndex()` 水化成本结构，之后所有代码只看这个结构。
 */
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
  /** 价格档位；缺采集数据的条目统一为 `unrated`，不做推测。 */
  p: PriceCode;
  /** 平台名（Web / iOS / 微信小程序…），由 wire 的 bitmask 水化而来。 */
  pl: string[];
  /** 更新时间，Unix **日序**（不是毫秒）；未采集到则缺失。 */
  u?: number;
  /** 是否采到官网链接。false 时详情页必须隐藏整个外站 CTA，而不是指向自己。 */
  w: boolean;
  /** `tools.json` 里的原始序号 —— 无查询时的浏览顺序。 */
  o: number;
};

/** `data/search-index.json` 的 v2 wire 结构。 */
export type SearchWire = {
  v: number;
  /** 分类 slug 字典。 */
  cats: string[];
  /** 标签名字典。 */
  tags: string[];
  /** 任务词字典。 */
  kw: string[];
  /** 平台名字典，下标即 bitmask 位序（按出现频次降序）。 */
  pl: string[];
  /** 定长槽位的记录数组，顺序 = 目录顺序。 */
  rows: unknown[][];
};

/** 命中依据里可能出现的字段。 */
export type SearchField =
  | 'name'
  | 'keyword'
  | 'description'
  | 'category'
  | 'tag'
  | 'price'
  | 'platform';

/** 一条命中结果。 */
export type SearchHit = {
  slug: string;
  score: number;
  /** 命中在哪些字段上，按强度优先序去重排列。 */
  matchedFields: SearchField[];
  /** 实际命中的检索词（原词或别名），按首次命中顺序。 */
  matchedTerms: string[];
  /** 完整词组零结果时才启用的部分匹配标记。 */
  partial?: boolean;
  /** 部分匹配时未满足的组代表词，供界面说明「还差哪一条」。 */
  unmatchedTerms?: string[];
};

/**
 * 把 v2 wire 解码成运行时记录。
 *
 * 结果按 wire 对象身份缓存在模块级 WeakMap 上：整站只在启动时解码一次，
 * 之后每次搜索/筛选都复用同一份数组 —— 那既是 `filterRecords` 的输入，
 * 也是下面评分缓存（键为记录数组）能命中的前提。
 */
const decodeCache = new WeakMap<object, SearchRecord[]>();

export function decodeSearchIndex(wire: unknown): SearchRecord[] {
  const cached = decodeCache.get(wire as object);
  if (cached) return cached;
  const w = wire as SearchWire;
  if (!w || w.v !== 2 || !Array.isArray(w.rows)) {
    throw new Error('search-index 需要 v:2 的 wire 格式，跑 npm run gen:search-index 重新生成');
  }
  const { cats, tags, kw, pl, rows } = w;
  const out: SearchRecord[] = rows.map((row, order) => {
    const r = row as [
      string,
      string,
      string,
      string,
      number[],
      number[],
      number[],
      number,
      number,
      number?,
      number?,
    ];
    const rec: SearchRecord = {
      s: r[0],
      n: r[1],
      d: r[2] ?? '',
      // 目录里每条 icon 都严格是 `/assets/icons/{slug}.{六种扩展名}`（生成脚本
      // 会断言），所以 wire 只存扩展名字母。这里复原成**站内相对路径**：
      // `NEXT_PUBLIC_ASSET_BASE` 由 `lib/assets.ts` 在渲染时前缀，索引里不能预拼
      // —— 本文件是零 import 的（Node 原生 TS 解析要求相对 import 带扩展名，
      // 而 TSC 的 bundler 解析不接受 `.ts` 后缀），所以 asset() 只能在上层调用。
      i: `/assets/icons/${r[0]}.${ICON_EXT[r[3]] ?? 'png'}`,
      c: (r[4] ?? []).map((id) => cats[id]).filter(Boolean) as string[],
      t: (r[5] ?? []).map((id) => tags[id]).filter(Boolean) as string[],
      p: PRICE_CODES[r[7]] ?? 'unrated',
      pl: platformNames(pl, r[8] ?? 0),
      w: r[10] === 1,
      o: order,
    };
    const keywords = (r[6] ?? []).map((id) => kw[id]).filter(Boolean) as string[];
    if (keywords.length) rec.k = keywords;
    if (typeof r[9] === 'number') rec.u = r[9];
    return rec;
  });
  decodeCache.set(w as object, out);
  return out;
}

/** bitmask → 平台名数组（位序即 `pl` 字典下标）。 */
function platformNames(pl: string[], mask: number): string[] {
  const out: string[] = [];
  for (let bit = 0; bit < pl.length; bit++) {
    if (mask & (1 << bit)) out.push(pl[bit]);
  }
  return out;
}

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

/**
 * 一条记录预归一化出来的检索面。小写与拆分只做一次，缓存在模块级 WeakMap 上。
 *
 * 为什么必须在意这件事：旧版 `searchIndex()` 每次调用都跑一遍 `prepareIndex()`，
 * 于是「敲一个字符重算 2081 条」——`/tools` 的即时搜索每敲一个字就重建整份
 * 归一化数组。键用记录数组本身（`decodeSearchIndex()` 对同一份 wire 返回同一
 * 数组），所以全站只会准备一次。
 */
type Prepared = {
  rec: SearchRecord;
  name: string;
  desc: string;
  cats: string[];
  tags: string[];
  keywords: string[];
  /** 价格档位的可读说法，参与 8 分档。 */
  price: string[];
  priceCode: PriceCode;
  /** 平台名小写，参与 6 分档。 */
  platforms: string[];
  /** 索引顺序，用于同分稳定排序。 */
  order: number;
};

const preparedCache = new WeakMap<SearchRecord[], Prepared[]>();

export function prepareIndex(records: SearchRecord[]): Prepared[] {
  const cached = preparedCache.get(records);
  if (cached) return cached;
  const out: Prepared[] = records.map((rec, order) => ({
    rec,
    order,
    name: (rec.n ?? '').toLowerCase(),
    desc: (rec.d ?? '').toLowerCase(),
    cats: (rec.c ?? []).map((s) => s.toLowerCase()),
    tags: (rec.t ?? []).map((s) => s.toLowerCase()),
    keywords: (rec.k ?? []).map((s) => s.toLowerCase()),
    price: PRICE_TERMS[rec.p] ?? [],
    priceCode: rec.p,
    platforms: (rec.pl ?? []).map((s) => s.toLowerCase()),
  }));
  preparedCache.set(records, out);
  return out;
}

/** 单个检索词命中的最强字段（强度序即 `SCORE` 的声明序）。 */
function matchOne(p: Prepared, term: string): { score: number; field: SearchField } | null {
  if (p.name === term) return { score: SCORE.exactName, field: 'name' };
  if (p.name.startsWith(term)) return { score: SCORE.prefixName, field: 'name' };
  if (p.name.includes(term)) return { score: SCORE.containsName, field: 'name' };
  if (p.keywords.some((k) => k.includes(term) || term.includes(k)))
    return { score: SCORE.keyword, field: 'keyword' };
  if (p.desc.includes(term)) return { score: SCORE.description, field: 'description' };
  if (p.cats.some((c) => c.includes(term))) return { score: SCORE.category, field: 'category' };
  if (p.tags.some((t) => t.includes(term))) return { score: SCORE.tag, field: 'tag' };
  if (p.price.some((t) => t.includes(term) || term.includes(t)))
    return { score: SCORE.price, field: 'price' };
  if (p.platforms.some((t) => t === term || t.includes(term)))
    return { score: SCORE.platform, field: 'platform' };
  return null;
}

/** 一个检索组：组内任一 `terms` 命中即算满足。 */
export type QueryGroup = {
  /** 概念组 ID（`INTENTS` 派生组用 `text`），供 UI 与测试定位。 */
  id: string;
  /** 组内用户原话代表词，用于说明「哪一组没满足」。 */
  label: string;
  terms: string[];
  notice?: string;
};

/** `price=` / `platform=` 这类写进搜索框的筛选词。 */
export type QueryFacets = {
  price?: PriceCode[];
  platforms?: string[];
};

export type AnalyzedQuery = {
  groups: QueryGroup[];
  /** 从搜索框剥出来的显式筛选词，调用方与 URL 上的筛选取交集。 */
  facets: QueryFacets;
  /** 概念组附带的口径提示（例如「免费可商用」的授权说明）。 */
  notices: string[];
  /** 去掉筛选词之后没有留下任何可检索内容。 */
  empty: boolean;
};

/** `price=` 的取值表，含旧 URL 的 `free` 别名。 */
const PRICE_QUERY_ALIASES: Record<string, PriceCode[]> = {
  free: ['fully-free', 'open-source'],
  'fully-free': ['fully-free', 'open-source'],
  免费: ['fully-free', 'open-source'],
  'open-source': ['open-source'],
  开源: ['open-source'],
  freemium: ['freemium'],
  '免费增值': ['freemium'],
  paid: ['paid'],
  付费: ['paid'],
  unrated: ['unrated'],
};

/**
 * 价格筛选值 → 允许的价格码。`free` 与 `fully-free` 同义（历史 URL 兼容），
 * 且都把 `open-source` 一起放行：开源必然免费，把它排除掉是纯粹的误伤。
 * 单独选 `open-source` 则只留开源。返回空数组表示这一档不认识，调用方忽略。
 */
export function priceValuesFor(price: string | undefined | null): PriceCode[] {
  if (!price) return [];
  return PRICE_QUERY_ALIASES[price.toLowerCase()] ?? [];
}

/** 按分隔符切成检索片段。 */
function tokenize(text: string): string[] {
  return text
    .split(/[\s,，、;；。|/()（）【】\[\]！!？?：:]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 泛词与中文单字：只在还有别的组可依据时才剥掉。 */
function isNoise(term: string): boolean {
  if (NOISE_TERMS.has(term)) return true;
  return term.length === 1 && !/[a-z0-9]/i.test(term);
}

/**
 * 解析用户输入 → 检索组 + 筛选词。
 *
 * 顺序（每一步都影响下一步，别再调整）：
 *   1. 剥 `price=x` / `platform=web` 这类筛选词（它们不是内容检索条件）；
 *   2. 扫语义概念组，命中的触发词从剩余文本里**消费掉**，避免同一个词再
 *      被当成独立片段做一次 AND 约束（「接微信的 AI 客服」若留下「微信」
 *      单片段，就会和概念组重复计分）；
 *   3. 剩余片段按空格/标点切分，逐个走 `expandQuery()` 的意图展开成组；
 *   4. 泛词与单字只在「还剩至少一个组」时剥掉；一个都不剩时保留原文，
 *      否则「AI」这种查询会变成零结果（旧版是可用的）。
 *
 * 组与组之间是 AND：「图片生成 + 电商」应当只给既能出图又能做商品图的工具。
 */
export function analyzeQuery(raw: string): AnalyzedQuery {
  const original = (raw ?? '').trim().toLowerCase();
  const facets: QueryFacets = {};
  const notices: string[] = [];

  if (!original) return { groups: [], facets, notices, empty: true };

  // 1. 剥筛选词。
  const segments: string[] = [];
  for (const seg of original.split(/\s+/)) {
    const m = /^(price|platform)=([\w-]+|[\u4e00-\u9fa5]+)$/.exec(seg);
    if (m && (m[1] === 'price' || m[1] === 'platform')) {
      if (m[1] === 'price') {
        const codes = priceValuesFor(m[2]);
        facets.price = [...(facets.price ?? []), ...codes];
      } else {
        facets.platforms = [...(facets.platforms ?? []), m[2]];
      }
      continue;
    }
    segments.push(seg);
  }
  // 中文「价格=免费」「平台=web」同样剥掉。
  const rest0 = segments.join(' ');
  const rest = rest0
    .replace(/价格\s*[=:：]\s*([^\s]+)/g, (_, v: string) => {
      facets.price = [...(facets.price ?? []), ...priceValuesFor(v)];
      return '';
    })
    .replace(/平台\s*[=:：]\s*([^\s]+)/g, (_, v: string) => {
      facets.platforms = [...(facets.platforms ?? []), v];
      return '';
    })
    .trim();

  const groups: QueryGroup[] = [];

  // 2. 概念组。
  let leftover = rest;
  for (const concept of CONCEPTS) {
    const trigger = concept.when.find((w) => leftover.includes(w));
    if (!trigger) continue;
    groups.push({
      id: concept.id,
      label: trigger,
      terms: concept.terms.map((t) => t.toLowerCase()),
      ...(concept.notice ? { notice: concept.notice } : {}),
    });
    if (concept.notice && !notices.includes(concept.notice)) notices.push(concept.notice);
    if (concept.price) facets.price = [...(facets.price ?? []), ...concept.price];
    leftover = leftover.split(trigger).join(' ');
  }

  // 3. 剩余片段成组。
  const tokens = tokenize(leftover);
  const meaningful = tokens.filter((t) => !isNoise(t));
  const usable = meaningful.length > 0 ? meaningful : tokens;
  for (const token of usable) {
    if (groups.some((g) => g.id === `text:${token}`)) continue;
    groups.push({
      id: `text:${token}`,
      label: token,
      terms: expandQuery(token),
    });
  }

  return { groups, facets, notices, empty: groups.length === 0 };
}

/** `matchedFields` 的展示优先序（与 `SCORE` 强度一致）。 */
const FIELD_PRIORITY: SearchField[] = [
  'name',
  'keyword',
  'description',
  'category',
  'tag',
  'price',
  'platform',
];

function rankFields(fields: Iterable<SearchField>): SearchField[] {
  const set = new Set(fields);
  return FIELD_PRIORITY.filter((f) => set.has(f));
}

type GroupMatch = { score: number; term: string; field: SearchField } | null;

/** 一组检索词对一条记录的最强命中（组内 OR）。 */
function matchGroup(p: Prepared, group: QueryGroup): GroupMatch {
  let best: GroupMatch = null;
  for (let i = 0; i < group.terms.length; i++) {
    const term = group.terms[i];
    const hit = matchOne(p, term);
    if (!hit) continue;
    // 组内第一个词是用户原话/触发词，不打折；意图别名打九折。
    const score = i === 0 ? hit.score : hit.score * ALIAS_FACTOR;
    if (!best || score > best.score) best = { score, term, field: hit.field };
  }
  return best;
}

/**
 * 检索。
 *
 * @param records 由 `decodeSearchIndex()` 水化出的索引（同一数组只会预处理一次）
 * @param query   用户原话
 * @param limit   上限（命令面板 30，`/tools` 用 Infinity）
 *
 * 语义：概念组之间 **AND**、组内 **OR**，分数是各组最强命中之和 —— 满足的条件
 * 越多、命中位置越强，排得越前。只有完整词组**零结果**时才降级为部分匹配
 * （满足任一组的条目都放行，并标记 `partial` + 未满足的组），因为「一行都不给」
 * 比「给多了」对用户更没有用，而无声放宽则会让用户以为自己搜到了答案。
 */
export function searchIndex(
  records: SearchRecord[],
  query: string,
  limit = 30,
): SearchHit[] {
  const { groups } = analyzeQuery(query);
  if (groups.length === 0) return [];

  const prepared = prepareIndex(records);
  const scored: { hit: SearchHit; name: string }[] = [];

  for (const p of prepared) {
    const hits = groups.map((g) => matchGroup(p, g));
    const matchedCount = hits.filter(Boolean).length;
    // 完整匹配要求所有组都满足；部分匹配放行满足 ≥1 组的条目。
    if (matchedCount !== groups.length && matchedCount === 0) continue;
    let score = 0;
    const fields = new Set<SearchField>();
    const terms: string[] = [];
    const unmatched: string[] = [];
    hits.forEach((h, i) => {
      if (!h) {
        unmatched.push(groups[i].label);
        return;
      }
      score += h.score;
      fields.add(h.field);
      if (!terms.includes(h.term)) terms.push(h.term);
    });
    scored.push({
      name: p.name,
      hit: {
        slug: p.rec.s,
        score,
        matchedFields: rankFields(fields),
        matchedTerms: terms,
        ...(matchedCount === groups.length
          ? {}
          : { partial: true, unmatchedTerms: unmatched }),
      },
    });
  }

  // 只有零结果才重跑一遍放行的部分匹配集合：先完整、后降级，顺序稳定。
  const pool = scored.some((s) => !s.hit.partial)
    ? scored.filter((s) => !s.hit.partial)
    : scored;

  return pool
    .sort((a, b) => {
      if (b.hit.score !== a.hit.score) return b.hit.score - a.hit.score;
      // 同分时短名优先（「Kimi」应该排在「Kimi PPT助手」前面）。
      const la = a.name.length;
      const lb = b.name.length;
      if (la !== lb) return la - lb;
      return a.hit.slug < b.hit.slug ? -1 : a.hit.slug > b.hit.slug ? 1 : 0;
    })
    .map((s) => s.hit)
    .slice(0, limit === Number.POSITIVE_INFINITY ? undefined : limit);
}

/** 中文排序用的稳定 collator：`numeric` 让 `Kimi 2` 排在 `Kimi 10` 前面。 */
const zhCollator = new Intl.Collator('zh-CN', { numeric: true });

export function compareNames(a: string, b: string): number {
  return zhCollator.compare(a, b);
}

/**
 * `/tools` 页的分类/标签/价格/平台过滤。与搜索分开是因为它们是**精确的集合筛选**，
 * 不该被意图展开影响（选了「AI法律助手」就是这一类，不要混进「合同」相关）。
 *
 * 语义：多选的分类、标签、平台都是**并集**（任一命中即放行）—— chip 是「再加一个
 * 视野」而不是「再削一刀」；价格用 `priceValuesFor()` 展开后的档位集合，与
 * `?price=free` 的 238 条历史口径一致。
 */
export function filterRecords(
  records: SearchRecord[],
  opts: {
    cats?: readonly string[];
    tags?: readonly string[];
    price?: string;
    platforms?: readonly string[];
  },
): SearchRecord[] {
  const { cats = [], tags = [], price = '', platforms = [] } = opts;
  const catSet = new Set(cats);
  const tagSet = new Set(tags);
  const platformSet = new Set(platforms.map((p) => p.toLowerCase()));
  const codes = priceValuesFor(price);
  const codeSet = new Set(codes);
  return records.filter((r) => {
    if (catSet.size > 0 && !(r.c ?? []).some((c) => catSet.has(c))) return false;
    if (tagSet.size > 0 && !(r.t ?? []).some((t) => tagSet.has(t))) return false;
    if (codeSet.size > 0 && !codeSet.has(r.p)) return false;
    if (platformSet.size > 0 && !(r.pl ?? []).some((p) => platformSet.has(p.toLowerCase())))
      return false;
    return true;
  });
}

/**
 * 目录排序。
 *
 *   ''（默认）  无查询 → `tools.json` 的原始顺序（原站的手调排序）；
 *               有查询 → 相关度，由调用方处理，这里不参与。
 *   'updated'   更新时间新→旧；**未采集到时间的条目稳定置后**，不显示「未知」
 *               也不与真实时间抢位。
 *   'name'      名称按 `zh-CN` 数字感知升序。
 *
 * 全部用稳定排序语义（同值时回落到目录序号），保证同一份数据永远同一顺序。
 */
export function sortRecords(
  records: SearchRecord[],
  sort: '' | 'updated' | 'name',
): SearchRecord[] {
  const list = records.slice();
  if (sort === 'updated') {
    return list.sort((a, b) => {
      const ua = typeof a.u === 'number' ? a.u : -1;
      const ub = typeof b.u === 'number' ? b.u : -1;
      if (ua !== ub) return ub - ua;
      return a.o - b.o;
    });
  }
  if (sort === 'name') {
    return list.sort((a, b) => {
      const c = compareNames(a.n ?? '', b.n ?? '');
      if (c !== 0) return c;
      return a.o - b.o;
    });
  }
  return list.sort((a, b) => a.o - b.o);
}

/** Unix 日序 → `YYYY-MM-DD`（用于展示与测试；缺失时返回空串，绝不写「未知」）。 */
export function updatedLabel(day: number | undefined): string {
  if (typeof day !== 'number') return '';
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}
