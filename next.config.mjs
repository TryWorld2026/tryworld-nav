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
    'data/home-rails.json',
    'data/category-order.json',
    'data/category-cards.json',
    'data/tags.json',
    'data/llms.txt',
  ]) {
    try {
      h.update(rel);
      h.update(readFileSync(join(ROOT, rel)));
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
