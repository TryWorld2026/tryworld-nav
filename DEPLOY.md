# 部署到 Cloudflare

代码在 GitHub，静态站点跑在 Cloudflare Workers，子域名指向站点。

已部署（2026-10-14 更新）：

| | |
|---|---|
| 站点 | https://nav.tryworld.com.cn |
| Worker | `tryworld-nav`（账号 TryWorld，`d59de4a1…cfe359`） |
| workers.dev | https://tryworld-nav.1822520752.workers.dev |
| 部署内容 | 8,707 个文件 / 1.05 GB（含媒体），首次上传约 20 分钟 |

## ⚠️ 部署前必读：媒体不能删

媒体**不能**在上传前从 `out/` 删掉。`public/assets/**` 被 gitignore，本地是唯一副本，而
`NEXT_PUBLIC_ASSET_BASE` 未设置，所以 `src/lib/assets.ts` 的 `asset()` 返回站点相对路径
`/assets/...` —— 这些文件线上只由本 Worker 的资产清单提供。**Workers Static Assets 每次
部署都整体替换资产清单**，因此拿缺媒体的 `out/` 去部署，会把线上 4188 张产品图全部打成 404。

`scripts/prune-out.mjs` 因此改为**默认保留媒体**，只有显式 `--prune-media`（且要求
`NEXT_PUBLIC_ASSET_BASE` 已设置）才会删。这正是本文档早先写给 CI 的那条警告，只是
`npm run deploy` 自己一直在违例。

```bash
npm run build                      # out/ 含媒体，8,707 文件 / 1.05 GB
node scripts/prune-out.mjs         # 只报数，不删（默认）
npx wrangler deploy
```

## 架构

```
GitHub TryWorld2026/tryworld-nav（私有，代码 ~28 MB，无媒体）
   │  push → Actions（目前 manual only，见下）
   ▼
next build (output: 'export')  ──►  out/
   │
   └──► Cloudflare Workers Static Assets  ◄── nav.tryworld.com.cn
            └── /assets/*  目前一起打包在 Worker 里
```

**为什么是全静态导出**：站点没有任何服务端行为了 —— 2140 个页面全部预渲染，`/tools` 的筛选在浏览器里做。所以 `output: 'export'`，部署到 Workers 不需要 Node 运行时，没有冷启动。

**媒体目前跟站点打包在一起**，没有走 R2 —— 因为账号还没开 R2（`wrangler r2 bucket list` 报 10042）。这能跑，但代价是首次上传 1.2 GB / 8,671 个文件、约 20 分钟。后续部署只有 HTML 变化，几十秒。

---

## ⚠️ CI 自动部署目前是关闭的

`.github/workflows/deploy.yml` 只有 `workflow_dispatch`，没有 `on: push`。原因：

**Workers Static Assets 的部署会整体替换资产清单**，而 CI 的 checkout 里没有 `public/assets`（被 gitignore）。所以从 CI 部署会把线上所有产品图删掉。

两种打开方式，推荐第一种：

1. **开 R2**（见下），然后 `ASSET_BASE_URL` 指过去 —— 部署不再带媒体，CI 就安全了
2. 把 `public/assets` 从 gitignore 里放出来，接受 364 MB 的仓库

在解决之前，从有媒体的机器上手动部署：`npm run deploy`。workflow 里也加了守卫步骤，万一开了 push 触发，缺媒体会直接报错而不是静默上线坏站。

---

## 一次性设置（已完成的部分标注 ✅）

### 1. 建 R2 桶并开公开访问 ⬜ 未做（账号未启用 R2）

Cloudflare 控制台 → R2 → Enable R2（需要绑支付方式，免费额度 10 GB/月）。

```bash
npx wrangler r2 bucket create tryworld-nav-assets
```

然后在 R2 控制台开 Public URL 或绑自定义域 `assets.tryworld.com.cn`。

### 2. 上传媒体 ⬜ 未做

```bash
npm run assets:check     # 只看有多少文件
npm run assets:push      # 上传 4188 个文件
```

### 3. 部署并绑域名 ✅ 已完成

```bash
npm run build
npm run deploy           # 已执行，8,671 文件 / 20 分钟
```

`wrangler.toml` 里的 `routes` 已配好 `nav.tryworld.com.cn`，DNS 记录由 Cloudflare 自动建。

### 4. SITE.url ✅ 已改为 `https://nav.tryworld.com.cn`

sitemap、robots.txt、og:url 全部跟随。

---

## 更新媒体后

```bash
npm run assets:push            # 增量不了——wrangler 没有批量列举接口，是全量上传
```

只在上传完新图后才改数据、才部署。

---

## 已知限制

- **`/tools?q=…` 的筛选在客户端做**。原站的 `/tools` 本身就是客户端组件（它的 SSR 只是一个骨架），所以行为一致，但 URL 参数不再影响首屏 HTML —— 对 SEO 无影响，因为列表页本来就不该被按 query 索引。
- **图片不做优化**（`images.unoptimized`）。Cloudflare Images 要额外收费，而全站只有新闻封面用了 `next/image`，且已经是 800×450 的小图。
- **R2 公开桶可被枚举**。如果不想让人列出全部 4188 个文件，用带签名的 URL 或走 Worker 代理；对产品图标来说一般无所谓。
- **`out/` 里每个页面有 `.html` 和 `.txt` 两份**（后者是 RSC flight payload，供客户端导航用）。这是 Next 静态导出的正常产物，4,552 个文件仍在 Cloudflare 的 20,000 上限内。
