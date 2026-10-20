# 部署到 Cloudflare

代码在 GitHub，静态站点跑在 Cloudflare Workers，子域名指向站点。

已部署（2026-10-15 更新，Version `b4c66c4d`）：

| | |
|---|---|
| 站点 | https://nav.tryworld.com.cn |
| Worker | `tryworld-nav`（账号 TryWorld，`d59de4a1…cfe359`） |
| workers.dev | https://tryworld-nav.1822520752.workers.dev（未开通，404 / code 1042） |
| 部署内容 | 8,685 个文件 / 1.04 GB（含媒体），首次上传约 20 分钟 |

部署历史（2026-10-15/16）：`c5355d01` 补 canonical 与 llms 修复；`b4c66c4d`
接入 AIHOT 资讯（`/news` 改为卡片流）；`3cd35c14` 落稳定 buildId；`aa4d0a13`
验证增量上传生效。

## ✅ 已修：稳定 buildId（部署从 51 分钟降到 24 秒）

**这是部署慢和频繁 `fetch failed` 的根因。** Next.js 默认给每次构建生成一个**随机**
buildId，并把它写进每个 HTML 与 RSC payload。实测两次相邻构建：

```
RKtEuuKNkLP1GDVT9nR5N   →   ko5WKLYZkNT5XXWWY5Tcy
```

于是 2125 个 HTML（460 MB）+ 2128 个 `.txt`（248 MB）**字节全部改变**。而 Workers
Static Assets 按内容哈希判断是否上传 —— 字节一变就等于全量重传。**只改一篇资讯，
也要重传 700 MB。**

修法是 `next.config.mjs` 里的 `generateBuildId`：用 sha256 汇总 `src/`、参与渲染的
`data/*.json` 与配置文件，算出内容派生的 buildId。刻意**排除** `data/aihot-meta.json`
——它的 `fetchedAt` 每次都变，会污染 buildId（第一版漏了这个，buildId 照样churn）。

实测结论：

| 场景 | buildId | 上传量 | 耗时 |
|---|---|---|---|
| 内容不变，连续构建 | 稳定 `aa5a133094b0a434` | 抽样 113 文件**逐字节一致** | — |
| 改动 `home-rails.json` | 变为 `a7a95f3858a7621f` | — | — |
| 恢复内容后重建 | 回到 `aa5a133094b0a434` | 与首次一致 | — |
| 部署（内容未变） | — | **`No updated asset files to upload.`** | **0.4 分钟** |
| 部署（过渡，线上仍是旧随机 id） | — | 4250 文件 | 13 分钟 |

最后两行是关键：稳定 buildId 上线后，**内容没变再部署 = 0 个文件 / 24 秒**。
改动的只有真正变化的文件，增量上传终于名副其实。

## ⚠️ robots.txt 与 Cloudflare 的托管块（2026-10-19 实测）

线上 `https://nav.tryworld.com.cn/robots.txt` **不是**仓库里那一份。Cloudflare 在边缘
往响应体**前面**插了一段：

```
# BEGIN Cloudflare Managed content
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /

# Training crawlers
User-agent: Amazonbot
Disallow: /
...
User-agent: Baiduspider
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: GPTBot
Disallow: /
...
# END Cloudflare Managed Content
```

这是 zone 上的 **AI Crawl Control / Content Signals** 设置产生的，**不在仓库里**，
所以 `git diff` 看不出来，CI 也测不到。

### 为什么要紧

`User-agent: Baiduspider` + `Disallow: /` 是一整站封禁。对一个中文站，这一条等于
「百度不收录本站」—— 这是本站最贵的一个默认值。

### 仓库侧已经做了什么（`src/app/robots.txt/route.ts`）

同名 user-agent 的多个 group 会被**合并**（Google / Bing 的官方实现如此），最宽松的
一条胜出。所以仓库这份文件现在：

- **显式放行中文与主流搜索引擎**（Baiduspider / Sogou / 360Spider / Bingbot / Yandex /
  DuckDuckBot / PetalBot），用来顶掉 Cloudflare 那条整站 `Disallow`；
- **显式放行 AI 爬虫到两份 LLM 文本**（`/llms.txt` 与 `/llms-full.txt`）。
  原来只放行 `/llms.txt`，可文件末尾的 `LLM-Full-Content:` 恰恰指向 `llms-full.txt`
  ——广告指向的地址反而不许爬，自己和自己打架；
- **显式封掉训练型爬虫**（CCBot / Bytespider / Omgili / PerplexityBot 等）整站。
  原站没写这一段，靠的是上游没有这些爬虫；现在上游有了，把策略写死在仓库里，
  站点的立场就不再依赖任何面板开关。

### 还需要你在面板上做一步（仓库改不掉）

Cloudflare 的块在**前面**，而部分爬虫（包括 Python 的 `urllib.robotparser`）采取
「首个匹配的 group 生效」。对这类爬虫，仓库里的 `Allow: /` 永远轮不到。
所以还要去控制台：

> **Cloudflare Dashboard → 域名 `tryworld.com.cn` → AI Crawl Control / Content Signals**
> → 关掉托管的 robots.txt 注入（或至少把 `Baiduspider` 从封禁名单里移除）

改完后用下面这条验证（应当**看不到** `# BEGIN Cloudflare Managed content`）：

```powershell
(Invoke-WebRequest https://nav.tryworld.com.cn/robots.txt -UseBasicParsing).Content
```

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

**3. 上传阶段会间歇性 `fetch failed`，重试即可——但要给足时间。** 根因是本机线路：
`nav.tryworld.com.cn` 解析到 `198.18.0.45`（RFC 2544 保留网段，本机代理的虚拟网卡），
**约 40% 的连接直接超时**。实测 5 次请求同一文件：3 次 200（1–2 秒）、2 次挂到 19–21 秒后
失败。这是本机环境问题，不是站点或配置问题。2026-10-15 一晚的实际记录：

| 时间 | 结果 | 说明 |
|---|---|---|
| 19:30 | ✗ | 上传阶段失败 |
| 19:34 | ✗ | 失败 |
| 19:35 | ✓ | 第三次成功，895 KB 日志 |
| 20:27 | ✗ | 卡在 `Building list of assets` 后无输出 |
| 20:45 | ✗ | 上传阶段 `fetch failed` |
| 20:54 | ✓ | 成功，`Uploaded 4255 files (4430 already uploaded) (3107.03 sec)` |
| 23:21 | ✗ | 卡在清单读取后无输出 |
| 23:46 | ✓ | 成功，4250 文件 / 580 秒 |
| 00:00 | ✓ | **`No updated asset files to upload.` / 24 秒** |

修好 buildId 之前**三次里成一次是常态**；修好之后，内容没变的部署几乎不会失败
（只需上传极少量文件，暴露在丢包线路下的时间从 51 分钟降到几秒）。

两个判断要点：

- **`Uploaded tryworld-nav` 才是成功标志。** 成功与失败的日志里都会出现 `ERROR` 字样——
  那是部署完成后 wrangler 上报遥测/校验步骤的报错，**与本次部署无关**，别被它误导。
- **部署前先确认 buildId 是否稳定**：`Get-ChildItem out\_next\static` 里除 `chunks`/`css`
  之外的那个目录名就是 buildId。连续两次构建后它若变了，说明有"每次都变"的输入混进了
  `contentBuildId()`，先修那个再部署，否则必然全量重传。

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
GitHub TryWorld2026/tryworld-nav（公开，代码 ~28 MB，无媒体）
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

## ✅ CI 自动部署：GitHub Release + Actions cache

R2 未开通，所以媒体不进 git、也不放 R2。当前方案：

1. 本地 `npm run media:backup` 生成 `assets-<日期>.tar.gz`（只含 icons/shots/tags/news）。
2. 改名为 `assets.tar.gz`，用 `gh release create media-v1 assets.tar.gz` 上传（网页上传也行）。
3. 仓库变量 `MEDIA_VERSION=media-v1`。
4. 仓库 Secret `CLOUDFLARE_WRANGLER_OAUTH` = 本机 wrangler 的登录凭据文件
   （`%APPDATA%/xdg.config/.wrangler/config/default.toml` 全文）。**不需要绑卡**，
   也不需要去 dashboard 手工创建 API Token。
5. `.github/workflows/deploy.yml` 每天 02:30 UTC（北京时间 10:30）构建并部署；也可手动 `workflow_dispatch`。

workflow 会先用 `actions/cache` 恢复 `public/assets/{icons,shots,tags,news}`，cache miss 时才从 Release 下载约 292 MB（解压后 327 MB）；解包后跑 `npm run media:check` 校验 data 引用的每个文件都存在，再 build、`prune --lean`、部署。媒体变化时发 `media-v2` 并把 `MEDIA_VERSION` 改过去；旧 release 可以删，保留最近一两个即可。

### 为什么用 wrangler 的 OAuth 凭据而不是 API Token

账号开不了 R2（要绑支付方式），而 API Token 同样只能在 dashboard 手工创建 —— 实测 wrangler 的 OAuth 凭据里**没有「API Tokens: Edit」权限**，调 `/user/tokens/permission_groups` 返回 403，所以没法自动签发一条 token 出来。

但 OAuth 凭据本身就能部署：它的 scope 含 `workers:write` / `workers_scripts:write` / `workers_routes:write`，与 `wrangler deploy` 需要的权限一致；而且**带 refresh_token，过期时 wrangler 会自己续期**。实测把 `expiration_time` 改到过去后跑 `wrangler whoami`，wrangler 刷新并写回配置，同一个 refresh_token 被消费过后仍能再次刷新，所以 CI 与本机可以共用同一份凭据。

**代价要知道**：OAuth 凭据的权限远大于一条只含 Workers 的 API Token（还带 `workers_kv:write`、`d1:write`、`pages:write`、`ssl_certs:write` 等），泄露等于账号相当一部分能力失守。它只存在 GitHub Actions Secrets（公开仓库的 secret 只有写权限者能读，也不会下发给 PR），在 runner 上临时落盘、用完随 runner 销毁。**更严格的做法**是去 dashboard 手工建一条仅含 Workers 权限的 API Token，替换掉这个 secret —— 但那需要绑卡才能自助完成，是当前约束下的一处妥协。

CI 上的凭据路径是 `$XDG_CONFIG_HOME/.wrangler/config/default.toml`（实测只有这个路径 wrangler 认；`$HOME/.wrangler` 与 `$XDG_CONFIG_HOME/wrangler` 都不行）。

为什么不是 `on: push`：news-refresh 用 `GITHUB_TOKEN` 提交，不会触发新的 workflow；普通 push 直接部署又会绕过 CI。日常内容靠 schedule，代码发布用 workflow_dispatch。

首次 CI 部署仍要上传约 1.1 GB / 1 万个文件；之后媒体不变，只传变化的 HTML/JS/CSS。

从有媒体的机器手动部署依然可用（也是 Release 快照的恢复路径）：`npm run deploy`。

---

## 一次性设置（已完成的部分标注 ✅）

> R2 尚未启用；当前自动部署走上面的 GitHub Release + Actions cache，下面的 R2 步骤保留为未来可选升级。

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
- **`out/` 里每个页面有 `.html` 和 `.txt` 两份**（后者是 RSC flight payload，供客户端导航用）。这是 Next 静态导出的正常产物。

- **Cloudflare 的文件数上限还剩多少余量。** 免费版 **20,000 个文件 / Worker 版本**
  （付费版 100,000；单文件上限 25 MiB；静态资产**没有总容量上限**）。
  2026-10-19 实测 `out/` 是 **15,375 个文件 / 1.35 GB**（其中 `out/assets` 10,436 个，
  HTML 2,337 个），**只剩 4,625 个余量**。每加一个工具就是 1 个图标 + 1 张截图
  （+ 缩略图的话是 3 个），所以：
  - `npm run gen:thumbs` 一旦开着跑，文件数会**翻三倍**（图标/截图各出 800/176 两档
    webp），**会直接撞上限**。跑之前先算一下。
  - 真要加到 4,000 个工具，媒体必须迁到 R2（见上文「一次性设置」第 1、2 步），
    否则 Static Assets 这条路走不到头。
  - 部署脚本 `scripts/deploy.ps1` 的媒体守卫目前盯的是**媒体文件数**（< 4000 即中止），
    它不检查**总文件数**。真要加这道守卫，阈值要按 20,000 的余量来定。
