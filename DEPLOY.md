# 部署到 Cloudflare

代码在 GitHub，静态站点跑在 Cloudflare Workers，子域名指向站点。

已部署（2026-10-15 更新，Version `b4c66c4d`）：

| | |
|---|---|
| 站点 | https://nav.tryworld.com.cn |
| Worker | `tryworld-nav`（账号 TryWorld，`d59de4a1…cfe359`） |
| workers.dev | https://tryworld-nav.1822520752.workers.dev（未开通，404 / code 1042） |
| 部署内容 | 8,685 个文件 / 1.04 GB（含媒体），首次上传约 20 分钟 |

部署历史（2026-10-15）：`c5355d01` 补 canonical 与 llms 修复；`b4c66c4d`
接入 AIHOT 资讯（`/news` 改为卡片流）。

## ⚠️ 部署的三个坑（2026-10-15 实测）

**1. 不要用管道跑 `wrangler deploy`。** 通过 PowerShell 管道（`npx wrangler deploy 2>&1 | Tee-Object …`）
调用时，进程会卡在 `Building list of assets...` 且**永不恢复**：日志 21 分钟无写入、CPU ≈0%、
没有任何 ESTABLISHED TCP 连接。表现与网络故障一模一样，但实际是管道缓冲问题。用直接文件重定向：

```powershell
Start-Process -FilePath "node" `
  -ArgumentList "node_modules\wrangler\bin\wrangler.js","deploy" `
  -WorkingDirectory "D:\codingXM\工具平台" `
  -RedirectStandardOutput "work\deploy.out" -RedirectStandardError "work\deploy.err" `
  -NoNewWindow -Wait
```

**2. 读取资产清单本身就要约 4 分钟。** `wrangler deploy --dry-run` 实测 247 秒，全部花在
`Read 8740 files from the assets directory`。所以部署总时长 ≈ 4 分钟建清单 + 上传时间，
**不要**因为前几分钟没有输出就判定卡死。判断依据应是 CPU 与 TCP 连接，不是日志。

**3. 上传阶段会间歇性 `fetch failed`，重试即可——但要给足时间。** 这是本机网络带宽导致的，
不是配置错误。2026-10-15 一晚的实际记录：

| 时间 | 结果 | 说明 |
|---|---|---|
| 19:30 | ✗ | 上传阶段失败 |
| 19:34 | ✗ | 失败 |
| 19:35 | ✓ | 第三次成功，895 KB 日志 |
| 20:27 | ✗ | 卡在 `Building list of assets` 后无输出 |
| 20:45 | ✗ | 上传阶段 `fetch failed` |
| 20:54 | ✓ | 成功，`Uploaded 4255 files (4430 already uploaded) (3107.03 sec)` |

也就是说**三次里成一次是常态**，别把它当成配置问题去改 `wrangler.toml`。

两个判断要点：

- **`Uploaded tryworld-nav` 才是成功标志。** 成功与失败的日志里都会出现 `ERROR` 字样——
  那是部署完成后 wrangler 上报遥测/校验步骤的报错，**与本次部署无关**，别被它误导。
- **上传很慢是正常的**：实测到 Cloudflare 的下载带宽约 274 KB/s，4255 个文件耗时 **51 分钟**。
  所以一次部署要按 **1 小时**预留，不要因为半小时没结束就 kill。中途 kill 是安全的
  （静态资产按内容寻址，已上传的不会白费），但下一次要重头算。

上传阶段实测对比：快的一次 `Uploaded 4271 files (4436 already uploaded) (143.69 sec)`，
慢的一次 3107 秒——差 20 倍，取决于当时的线路状况。

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

**媒体目前跟站点打包在一起**，没有走 R2 —— 因为账号还没开 R2（`wrangler r2 bucket list` 报 10042）。这能跑，但代价是首次上传约 1.05 GB / 8,707 个文件、约 20 分钟。后续部署只有 HTML 变化，几十秒。

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
npm run deploy           # 已执行，8,707 文件 / 约 20 分钟
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
