/**
 * 工具栈分享链接 —— 纯静态站也能把「我选的这几个」发给别人。
 *
 * 为什么不是「生成一条短链存服务端」：本站 `output: 'export'`，没有服务端，
 * 也没有账号。任何「存下来再分享」都要求一个会消失的外部服务。所以分享的
 * **不是我的收藏状态**，而是**链接里的 slug 列表**：收件人打开时，页面用
 * 目录索引（`search-index.json`）与人工判断（`verdict-index.json`）现场还原
 * 同一份清单。代价是分享出去的是快照（不含收藏时间、不含顺序之外的个人信息），
 * 这反而更安全 —— 链接里只有公开的 slug。
 *
 * 零 import：与 `search.ts` / `card-sort.ts` / `compare.ts` 同一条约束
 * （`node --test` 直接 import，Node 原生 TS 解析不接受无扩展名相对导入）。
 */

/** 查询参数名。短、可读、不撞 `/tools` 的 `cat` / `price` / `plat`。 */
export const STACK_PARAM = 'ids';

/** 一份栈最多收几个。40 × 最长 24 字符 slug ≈ 1 KB，远低于任何浏览器与社交平台的 URL 上限。 */
export const STACK_MAX = 40;

/**
 * slug 的合法形状。
 *
 * 分享链接来自外部输入（别人发的、被改过的、被截断的），所以必须在**入口**
 * 就把脏数据挡掉：`javascript:` / 大写 / 空白 / 中文 / 超长，一律视为不存在。
 * 目录里的 slug 全部是小写 kebab-case（如 `lovart-ai`、`hedra`）。
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * 去重、去脏、截断 —— 编码与解码共用这一条路径，所以「写出去的链接一定能读回来」。
 *
 * 顺序保留：用户在收藏页看到的顺序就是分享出去的顺序（最近收藏在前）。
 */
export function normalizeSlugs(input: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input ?? []) {
    const slug = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!SLUG_RE.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= STACK_MAX) break;
  }
  return out;
}

/** slug 列表 → 查询参数值（逗号分隔）。空列表返回空串，调用方据此走「没有可分享的内容」。 */
export function encodeStackParam(slugs: readonly string[] | null | undefined): string {
  return normalizeSlugs(slugs).join(',');
}

/** 查询参数值 → slug 列表。任何异常输入都返回 `[]`，绝不抛。 */
export function decodeStackParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return normalizeSlugs(raw.split(','));
}

/**
 * 站内相对路径：`/stack?ids=a,b,c`。
 *
 * 不带 `site.url` —— 复制链接时用 `window.location.origin` 拼，这样本地预览、
 * 预览域名、正式域名三种环境下复制出来的都是**当前打开的那个站**。
 */
export function sharePath(slugs: readonly string[] | null | undefined): string {
  const ids = encodeStackParam(slugs);
  return ids ? `/stack?${STACK_PARAM}=${ids}` : '/stack';
}

/** 绝对地址。`baseUrl` 末尾的斜杠会被吃掉，避免 `//stack`。 */
export function buildShareUrl(baseUrl: string, slugs: readonly string[] | null | undefined): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '');
  return `${base}${sharePath(slugs)}`;
}
