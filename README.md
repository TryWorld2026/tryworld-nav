# tryworld-nav · 试界导航

一个 AI 工具导航站，静态导出后部署在 Cloudflare Workers Static Assets 上。

线上：https://nav.tryworld.com.cn ｜ 仓库：`github.com/TryWorld2026/tryworld-nav`（私有）

## 这是什么

Next.js 15.5.27（`output: 'export'`）+ React 19 + Tailwind 3.4 的纯静态站，
**没有服务端**：所有页面在构建期预渲染，`src/lib/data.ts` 把 `data/*.json`
读成内存表，页面直接取。没有数据库、没有 API、没有运行时鉴权。

| | |
|---|---|
| 工具 | 2081 个（`data/tools.json`） |
| 分类 | 26 个 |
| 页面 | 2135 个（`out/*.html`） |
| 新闻 | 10 篇 |
| 配套数据 | `data/tool-extras.json` 2081 条，与 `tools.json` 一一对应，0 缺失 |
| 构建产物 | `out/` 8706 个文件 / 1040 MB |

数字会随重新抓取变化，用 `node scripts/census.mjs` 重算，不要手抄。

## 快速开始

```bash
npm install       # node_modules 不在 git 里
npm run dev       # http://localhost:3000
npm run build     # 约 3.9 分钟，产出 out/
npm run lint      # eslint，当前 exit 0
npm run deploy    # build + prune + wrangler deploy（约 20 分钟首次）
```

`out/` 很大（1040 MB）是因为媒体全量打包，见下面「部署」。

## 目录

```
data/              抓取来的数据，git 跟踪（17 MB）
public/assets/     产品图标与截图，4188 个文件 337 MB —— **不在 git**
src/lib/data.ts    唯一的取数入口，把 data/ 读成内存表
src/app/          App Router 页面，全部静态
src/components/    复刻原站 markup 的组件，注释里普遍写明「哪里与原站不同」
scripts/          census / prune-out / 媒体备份还原等
```

## 部署

Worker 名 `tryworld-nav`，自定义域名 `nav.tryworld.com.cn`。
`wrangler.toml` 里 `not_found_handling = "404-page"`，所以 `out/not-found.html`
会成为全站 404 页（实测 94 KB）。

**CI 自动部署目前是关的**（`.github/workflows/deploy.yml` 只有
`workflow_dispatch`），原因写在工作流里：媒体不进 git，从 CI 部署会因为
Workers Static Assets 的整体替换清单把线上产品图删光。要打通 CI 必须先有
R2（账号当前报 10042，未开通）并把 `NEXT_PUBLIC_ASSET_BASE` 接上——
`src/lib/assets.ts` 已支持这个开关。

`.github/workflows/ci.yml` 跑 lint / tsc / census / assets:check（不需要媒体），
已在 `b1af50a` 推送后生效。

部署细节与回滚见 [DEPLOY.md](DEPLOY.md)，媒体备份还原见 [MIGRATION.md](MIGRATION.md)。

## 与原站的差异（DEVIATIONS）

这个站是从原站逐页复刻的，`src/` 里大量注释在解释「为什么这里和原站不一样」。
收敛成一份清单，省得每次都要 grep：

| # | 差异 | 位置 |
|---|---|---|
| 1 | 新闻索引页原站会先流式输出 12 个 `animate-pulse` 骨架卡，这里直接渲染数据，骨架丢掉 | `src/app/news/page.tsx` |
| 2 | 工具卡的图标 loading 占位方块（原站是 `next/image` 的解码占位，解码后会移除）不实现——本地图标同步解码，保留会出现永久脉冲灰块 | `src/components/tool-card.tsx` |
| 3 | 工具卡外层 `data-state="closed"` 不输出（Radix 状态属性，原站 CSS 没有任何规则选它） | `src/components/tool-card.tsx` |
| 4 | 「更多AI工具」网格原站是每次渲染重掷的随机抽样，这里改成 slug 的纯函数（同一工具页永远同样网格） | `src/lib/data.ts` 的 `moreTools` |
| 5 | 「类似工具」同理，但保留按品类抽取的关系 | `src/lib/data.ts` |
| 6 | `layout.tsx` 里 `<main>` 套 `<main>` 是无效 HTML，但它是侧栏全高边线对齐的唯一手段，有意保留 | `src/app/layout.tsx` |
| 7 | 没有登录/注册等用户功能：原站这些是服务端能力，静态站没有对应实现，只保留按钮外观 | `src/components/header.tsx` |

`data/tool-extras.json` 里的 `more` / `related` / `latest` 三个字段同样
不参与渲染，只作溯源保留——原因见 `src/lib/types.ts` 的类型注释。

## 已知问题

- **媒体只有一份本地副本** + `D:\tryworld-backups\` 的 tar.gz。git 里没有，机器坏了就没了。定期跑 `npm run media:backup`。
- **`llms.txt` / `llms-full.txt` 的域名已改写**：`data/llms.txt` 是原站索引，47 个绝对链接都指向 `tryworld.com.cn`，生成时统一改成本站，否则等于给原站导流。`llms-full.txt`（8.3 MB）由 `scripts/generate-llms-full.mjs` 生成并挂进 `npm run build`，不会再出现 robots 声明了却 404 的情况。
- **首页 HTML 5.86 MB / 1496 个 `<img>`**：图片都带 `loading=lazy` 和宽高，但没有 `srcset`、没有 `fetchpriority`，移动端首屏是明确风险。
- **`.txt`（RSC flight）2135 个占 240 MB**：`npm run prune` 的 `--lean` 可裁掉，但会保留 `llms.txt` / `llms-full.txt`（两者由 robots.txt 声明，删了就是 404）。
- **零测试**，CI 不跑 build（跑 lint / tsc / census / assets:check）。
- `package.json` 的 `name` 是 `tryworld-portal`，与仓库名、Worker 名不一致。
- eslint 9 仍用 `FlatCompat` 桥接 `next/core-web-vitals`（官方已弃用的接法）。

## 数据可信度

`node scripts/census.mjs` 输出当前抓取口径的普查：每个字段的覆盖率、
pricing 徽章分布、`more/related/latest` 的死引用数、prose 总字符数。
`src/lib/types.ts`、`src/lib/pricing.ts`、`src/lib/data.ts` 里的覆盖数字
抄自它的输出，重新抓取后请重跑一次再改注释。
`npm run census` 也会核对媒体文件数（4188 个 / 327 MB），
改 `scripts/sync-assets.mjs` 注释前先跑它。

## 已验证

`npm run build` 通过（2140 页静态生成，产物 2135 个 `.html`），
`npm run lint` exit 0、`npx tsc --noEmit` exit 0。每个路由都带上了
`<link rel="canonical" href="https://nav.tryworld.com.cn/...">`
（2134/2135，唯一例外是 `404.html`，它没有规范 URL），
`npm run prune --lean` 保留 `llms.txt` 与 `llms-full.txt`。

2026-10-15 部署后复验（Version `c5355d01`）：

- `llms-full.txt` 由 404 转为 **200 / 8,516,507 bytes**（robots.txt 早已声明它）
- `llms.txt` 47 条链接全部指向本站，指向原站 `tryworld.com.cn` 的为 **0**
- canonical 在 `/`、`/tools`、`/news`、`/categories`、`/collections`、`/about`、
  `/tools/[slug]`、`/news/[slug]`、`/privacy-policy` 全部存在
- 媒体未丢失：随机抽样 120 个 `/assets/*` **120/120 返回 200**
- 路由健康：sitemap 2134 条中随机抽 60 条 **60/60 返回 200**
- 交互正常：`/tools` 客户端筛选 2081 → 搜「视频」334 → 重置 2081 → 点分类 34，
  浏览器 `pageerror` **0**

## 快速开始（命令速查）

```bash
npm run build     # 约 3.9 分钟，产出 out/（会先生成 public/llms-full.txt）
npm run lint      # eslint，当前 exit 0
npm run deploy    # build + prune + wrangler deploy（约 20 分钟首次）
npm run census    # 重算数据口径的普查数字
```
