/** @type {import('next').NextConfig} */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

/*
 * 内容派生的 buildId —— 这是部署时长的主要决定因素，改动前请先读完。
 *
 * Next.js 默认给每次构建生成一个**随机** buildId（如 `RKtEuuKNkLP1GDVT9nR5N`），
 * 并把它写进每个 HTML 与 RSC payload 的引用里。实测后果：
 *
 *   - 2026-10-15 两次相邻构建，buildId 从 `RKtEuuKNkLP1GDVT9nR5N` 变成
 *     `ko5WKLYZkNT5XXWWY5Tcy`，于是 2125 个 HTML（460 MB）与 2128 个 `.txt`
 *     （248 MB）**字节全部改变**；
 *   - 而 Cloudflare Workers Static Assets 按内容哈希判断是否需要上传，字节一变
 *     就等于全量重传 —— 一次部署 4255 个文件 / 51 分钟，就是这么来的；
 *   - 于是「只改了一篇资讯」也要重传 700 MB。
 *
 * 换成由**输入内容**算出来的 buildId 后，内容没变则 buildId 不变，产物逐字节
 * 可复现，增量上传才真正生效（只传真正改动的那些文件）。
 *
 * 取哪些输入：`src/`（代码）+ 影响产物的数据文件 + 配置文件。刻意**排除**两类
 * 每次构建都会变、但不影响页面字节的东西：
 *
 *   1. `data/aihot-meta.json` —— 它的 `fetchedAt` 是抓取时刻，每次都变；
 *   2. 时间戳类字段。凡是不进 HTML 的元数据都不该进 buildId。
 *
 * 也刻意**不含**时间戳或随机量 —— 那会让它每次都变，等于没做。
 *
 * 代价：buildId 不再随构建变化，所以浏览器缓存的 `_buildManifest.js` 会在内容
 * 更新时按新路径重新取；这是 Next 的正常行为，且 `_next/static/chunks/*` 本来就是
 * 内容哈希命名，不受影响。
 */
function contentBuildId() {
  const h = createHash('sha256');

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return; // 目录不存在就跳过，不让构建因缺文件而挂
    }
    for (const name of entries.sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        // 相对路径也进哈希：改名/移动同样要产生新 buildId。
        h.update(p.slice(ROOT.length).replace(/\\/g, '/'));
        h.update(readFileSync(p));
      }
    }
  };

  // `src/` 全量参与：任何代码改动都应该换 buildId。
  walk(join(ROOT, 'src'));

  // `data/` 里只有真正渲染进页面的文件参与。逐个列出而不是整个目录遍历，
  // 正是为了把 `aihot-meta.json` 这类「每次构建都变、但不影响产物」的元数据挡在外面。
  for (const rel of [
    'data/tools.json',
    'data/categories.json',
    'data/sections.json',
    'data/featured.json',
    'data/friend-links.json',
    'data/tool-extras.json',
    'data/latest-additions.json',
    'data/collections.json',
    'data/news.json',
    'data/aihot-daily.json',
    'data/home-rails.json',
    'data/category-order.json',
    'data/category-cards.json',
    'data/tags.json',
    'data/llms.txt',
    // 2026-10-18 起，客户端需要的两份派生数据由 `npm run gen:all` 生成：
    //   - nav.json            26 分类 / 5 推荐 / 9 标签（页眉、侧栏、搜索面板）
    //   - search-index.json   2081 条搜索索引（命令面板与 /tools 的筛选）
    // 它们都进页面与产物，必须参与哈希；否则「只改了搜索索引」不会换 buildId，
    // 浏览器缓存命中旧 chunk，线上还是旧结果。
    'data/nav.json',
    'data/search-index.json',
  ]) {
    try {
      h.update(rel);
      const buf = readFileSync(join(ROOT, rel));
      // `data/aihot-daily.json` 顶层带 `fetchedAt`（抓取时刻，每次构建都变）。
      // 它**不进页面**，所以从哈希输入里剥掉；否则每天定时抓取一次就换 buildId，
      // 全站 HTML 重新命名、增量上传失效（这正是本节开头要避免的问题）。
      // 用字符串替换而不是 JSON.parse/stringify：文件 1.4 MB，构建期不值得
      // 再解析一遍，而 `"fetchedAt":"…"` 在顶层只出现一次。
      h.update(
        rel === 'data/aihot-daily.json'
          ? Buffer.from(buf.toString('utf8').replace(/"fetchedAt":"[^"]*"/, '"fetchedAt":""'))
          : buf,
      );
    } catch {
      /* 可选文件，缺了就算了 */
    }
  }

  for (const rel of ['package.json', 'next.config.mjs', 'tailwind.config.ts']) {
    try {
      h.update(rel);
      h.update(readFileSync(join(ROOT, rel)));
    } catch {
      /* 可选文件，缺了就算了 */
    }
  }

  /*
   * `public/sw.js` 是 `scripts/generate-sw.mjs` 的产物，版本号来自它自己的
   * 模板哈希。它**不进任何页面 HTML**，但每次它的字节都可能变（改了缓存策略
   * 就是新的 SW）—— 而它又是「部署时要上传的文件」之一。
   *
   * 不把它算进 buildId 的后果是：某个改动只影响 sw.js 时，buildId 不变，
   * 部署脚本按内容哈希判断「无需上传」，于是线上的 Service Worker 永远停在
   * 旧版本。这不是理论风险：缓存策略的修正只在 sw.js 里，漏传等于没修。
   */
  try {
    h.update('public/sw.js');
    h.update(readFileSync(join(ROOT, 'public', 'sw.js')));
  } catch {
    /* 还没生成过 SW 的检出（比如纯 CI 检查）不影响 buildId */
  }

  return h.digest('hex').slice(0, 16);
}

/*
 * Static export.
 *
 * The site has no server-side behaviour left to run: every route is either
 * prerendered content or a client component that filters in the browser, so the
 * whole thing ships as files. That is what lets it go on Cloudflare Workers /
 * Pages with no Node runtime and no cold starts.
 *
 * Two consequences worth knowing:
 *
 *   - `images.unoptimized` — the optimizer is a Node server. Cloudflare Images
 *     would cost money and the two `next/image` uses are 800×450 article covers
 *     that are already small, so the browser gets the original file instead.
 *
 *   - `output: 'export'` rejects any route that touches `searchParams`,
 *     `cookies()`, `headers()` or Node built-ins at request time. `/tools` used
 *     to read `searchParams` server-side; it now reads the URL on the client
 *     (see components/tools-explorer.tsx), which is also what the origin does.
 *
 * ## 为什么全站每个 `<Link>` 都写着 `prefetch={false}`
 *
 * **这不是遗留物，不要删。** 2026-10-22 线上实测（`work/prefetch-cost.mjs`）：
 *
 *   首页加载 → 24 个 `404`；点一次导航 → 再加 22 个，全部是
 *   `/xxx.txt?_rsc=…` 的 RSC 预取请求。
 *
 * 原因是 `output: 'export'` 的产物形态：`out/` 里**只有 `.html`，没有任何
 * `.txt` / `.rsc`**（Next 15.5.27 静态导出把 RSC payload 内联进了 HTML），
 * 而 App Router 的 `<Link>` 仍按「旁边有 `.txt`」的老模型去预取 —— 于是每次
 * 导航都白跑一批必然 404 的请求：浪费带宽、污染控制台，且**没有**任何
 * 预取收益（payload 根本不存在）。
 *
 * 导航本身不受影响：整页加载照旧（实测点分类链接能正确到达，`h1` 正确）。
 * Next 没有全局关闭预取的配置项（`prefetch` 默认 `null`，只能逐 `<Link>` 传
 * `false`），所以只能每个标签都写。新增 `<Link>` 时**必须**跟着写。
 *
 * 更早的历史：`scripts/prune-out.mjs --lean` 也曾删掉 RSC payload（省 240 MB /
 * 2339 个文件），但当前构建根本不产出它们 —— 那一层现在是无操作，保留它是
 * 为了 Cloudflare 20,000 文件上限的余量策略。
 */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 见上方 `contentBuildId` 的说明：默认随机 buildId 会让每次部署全量重传。
  generateBuildId: contentBuildId,
  // `trailingSlash` is left at Next's default (false), which is what Cloudflare
  // Pages and Workers Static Assets both expect.
};

export default nextConfig;
