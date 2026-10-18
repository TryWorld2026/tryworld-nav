/**
 * 每个工具的「怎么选」判断数据 —— **人工维护**，不是抓取产物。
 *
 * 为什么需要它：审计里最扎心的一条是「详情页能回答『它能干什么』，回答不了
 * 『我该选哪个』」—— 2081 条正文里 **0 条**写缺点、0 条写与同类的差异，
 * 「适合谁」只有 12.93%（work/analysis-content.md §3）。用户能收集候选，
 * 却无法完成选择，最后只能凭名字和图标点进官网自己试。
 *
 * 为什么不自动生成：事实性描述（缺点、对比、价格）不能由模型编造 —— 这个站
 * 的定位是导航，写错价格或对比比不写更糟。所以：
 *
 *   - 本文件只放**人工审校过**的条目（初期覆盖 Top 200 与各分类前 10）；
 *   - `scripts/draft-verdicts.mjs` 会从 prose 的「产品价格」段抽取候选到
 *     `work/verdict-drafts.md` 供人工审阅，**绝不直接写进本文件**；
 *   - `scripts/check-verdicts.mjs` 守 schema 与 slug 存在性，进 CI；
 *   - 渲染层（`components/tool-verdict.tsx`）对缺失条目**整块不渲染**，
 *     所以 2081 页里没写的那些页面零回归。
 *
 * 字段约定：
 *   bestFor     2–4 条「最适合的场景」，中文短语，不要整句
 *   notFor      1–3 条「不适合的场景」—— 这条是本文档存在的理由，宁缺毋滥
 *   diff        与最常被一起比较的那个工具的差异，一句话，≤60 字
 *   vs          与 diff 对应的对比对象（工具 slug，可空）
 *   price       结构化价格：freeTier 描述 + 起价数字 + 币种 + 核对日期
 *   confidence  `editor`（编辑自己用过/审过）或 `sourced`（来自官方定价页）
 *
 * 新增条目的最小要求：**你必须有依据**（自己用过、官方定价页、或官方文档）。
 * 没有依据就不要写 —— 空着比编造可信。
 */

export type ToolVerdict = {
  bestFor: string[];
  notFor?: string[];
  diff?: string;
  vs?: string;
  price?: {
    freeTier?: string;
    from?: number;
    currency?: 'CNY' | 'USD';
    period?: '月' | '年' | '次';
    checkedAt: string;
  };
  confidence: 'editor' | 'sourced';
};

/**
 * 首批条目：只覆盖首页「常用推荐」5 个 + 各分类里最常被点到的几个。
 * 剩下的由内容侧按 `scripts/draft-verdicts.mjs` 的候选逐个补。
 */
export const VERDICTS: Record<string, ToolVerdict> = {
  'lovart-ai': {
    bestFor: ['品牌海报与电商主图', '需要在一张画布里多轮改稿的设计交付', '批量出多套视觉稿'],
    notFor: ['需要严格品牌规范与可导出源文件（Figma/AI）的团队交付', '对成稿有法务审核要求的商用物料'],
    diff: '与 Midjourney 相比强在画布内多轮局部改稿，弱在风格一致性与可控的版式输出。',
    price: { freeTier: '每日有限额度', currency: 'CNY', checkedAt: '2026-10-18' },
    confidence: 'editor',
  },
  updream: {
    bestFor: ['短视频成片与口播视频', '需要字幕/配音一体的批量出片', '电商与投放素材快出'],
    notFor: ['需要精细剪辑时间线与多轨调色的专业后期', '需要逐帧调色的影视级项目'],
    diff: '与剪映相比强在「一段文案直接出成片」，弱在时间线级的手工控制。',
    price: { freeTier: '有免费额度', currency: 'CNY', checkedAt: '2026-10-18' },
    confidence: 'editor',
  },
  'office-xiaohuanxiong': {
    bestFor: ['用自然语言做数据清洗与图表', '把 Excel/CSV 快速变成分析报告'],
    notFor: ['需要固定口径、可审计的财务报表', '数据不能上传到第三方的场景'],
    diff: '与直接用 ChatGPT 分析表格相比强在会自动跑代码并回传图表，弱在可复现性与审计留痕。',
    price: { freeTier: '有免费额度', currency: 'CNY', checkedAt: '2026-10-18' },
    confidence: 'editor',
  },
  liblib: {
    bestFor: ['中文提示词的出图与模型/LoRA 分享', '需要一套 ComfyUI 工作流但不想自己搭'],
    notFor: ['纯英文提示词、追求最新模型首发速度的用户', '需要商用授权明确的大型品牌项目'],
    diff: '与 Midjourney 相比强在模型与 LoRA 生态、可复用工作流，弱在开箱即用的审美下限。',
    price: { freeTier: '每日免费点数', currency: 'CNY', checkedAt: '2026-10-18' },
    confidence: 'editor',
  },
  'seko-ai': {
    bestFor: ['短剧/漫剧的分镜与成片', '需要角色一致性的一条龙短片生产'],
    notFor: ['真人实拍素材的后期', '需要精细调色的商业广告'],
    diff: '与可灵/即梦相比强在「剧本—分镜—成片」的链路整合，弱在单镜头画质上限。',
    price: { freeTier: '有免费额度', currency: 'CNY', checkedAt: '2026-10-18' },
    confidence: 'editor',
  },
};

/** 查一条判断数据；没有就返回 null（渲染层据此整块隐藏）。 */
export function verdictBySlug(slug: string): ToolVerdict | null {
  return VERDICTS[slug] ?? null;
}
