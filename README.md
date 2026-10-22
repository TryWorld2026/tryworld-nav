# tryworld-nav · 试界导航

一个 AI 工具导航站，静态导出后部署在 Cloudflare Workers Static Assets 上。

线上：https://nav.tryworld.com.cn ｜ 仓库：`github.com/TryWorld2026/tryworld-nav`（公开）

## 这是什么

Next.js 15.5.27（`output: 'export'`）+ React 19 + Tailwind 3.4 的纯静态站，
**没有服务端**：所有页面在构建期预渲染，`src/lib/data.ts` 把 `data/*.json`
读成内存表，页面直接取。没有数据库、没有 API、没有运行时鉴权。

| | |
|---|---|
| 工具 | 2081 个（`data/tools.json`） |
| 分类 | 26 个 |
| 页面 | 2642 个（`out/*.html`；含日报 180 期 × 2 种变体、298 个二选一对比页） |
| 新闻 | AIHOT 精选卡片流，条数随抓取变化（2026-10-15 起） |
| 「怎么选」判断 | 363 条（17.4%），覆盖 26/26 分类的 rank 1–12 |
| 配套数据 | `data/tool-extras.json` 2081 条，与 `tools.json` 一一对应，0 缺失 |
| 构建产物 | `out/` 8706 个文件 / 1040 MB |

数字会随重新抓取变化，用 `node scripts/census.mjs` 重算，不要手抄。

## 快速开始

```bash
npm install       # node_modules 不在 git 里
npm run dev       # http://localhost:3000
npm run build     # 约 8–11 分钟，产出 out/
npm run lint      # eslint，当前 exit 0
npm test          # 114 项；产物断言需要先 build（交互 8 条需先 npm run preview）
```

**新检出会没有媒体文件。** `public/assets/{icons,shots,tags,news}`（约 4200 个
文件、327 MB）**不在 git**，理由见 `.gitignore` 里的注释。没有它们也能：
`npm run dev` / `npm run build` / `npm test` **全部正常**——图片路径是烘焙进
HTML 的字符串，没人检查文件是否存在，页面上的图会 404 但不会报错。要让图片
真的显示，从备份包还原（`npm run media:restore`，见 [MIGRATION.md](MIGRATION.md)）。

同理，缩略图（`public/assets/thumbs/`，6245 个 webp）也不在 git，
`npm run build` 会自动重新生成；单独跑用 `npm run gen:thumbs`。
缺失时页面不输出 `srcSet`、直接退回原图，不会破图。

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

**部署用 `scripts/deploy.ps1`，不要手敲 `npx wrangler deploy`。** 这个脚本把
2026-10-15 一晚上踩出来的坑固化了下来（手工部署曾三次里只成一次）：

```powershell
.\scripts\deploy.ps1                 # build + 守卫检查 + prune + 部署（带重试）
.\scripts\deploy.ps1 -SkipBuild      # 直接部署现有 out/（调试用）
.\scripts\deploy.ps1 -MaxAttempts 5  # 线路差时多试几次
```

它做四件事：**不用管道**（管道调用 wrangler 会静默卡死在 `Building list of
assets`）、**媒体守卫**（媒体少于 4000 个文件就中止，否则会把线上 4188 张产品图
打成 404）、**buildId 稳定性检查**、**失败自动重试**（按 `Uploaded tryworld-nav`
判定成败，而不是日志里的 `ERROR` 字样）。

**部署已经从 51 分钟降到 24 秒。** 原先 Next.js 每次构建生成随机 buildId 并写进
每个 HTML，导致每次部署全量重传 700 MB；现在 `next.config.mjs` 用内容派生
buildId，内容不变时实测 `No updated asset files to upload.`（0 个文件 / 24 秒）。
细节见 [DEPLOY.md](DEPLOY.md)。

**CI 自动部署方案已接入**（`.github/workflows/deploy.yml` 每天 02:30 UTC 运行；
需先完成一次媒体 Release 与变量/Secrets 设置，见 [DEPLOY.md](DEPLOY.md)）：
媒体不进 git，但 `npm run media:backup` 生成的包会作为 GitHub Release 资产
（`assets.tar.gz`）保存；workflow 用 `actions/cache` 缓存解包后的
`public/assets/{icons,shots,tags,news}`，cache miss 时才从 Release 下载。
仓库变量 `MEDIA_VERSION` 指向当前媒体 release；媒体变化时发一个新 release
并更新该变量。部署凭据用 wrangler 的 OAuth 登录态（Secret
`CLOUDFLARE_WRANGLER_OAUTH`），凭据过期时 wrangler 会自己续期，不需要绑卡、
也不需要去 dashboard 手工创建 API Token。`npm run media:check` 会在部署前
校验 data 引用的每个文件都存在，避免旧的媒体快照静默产生 404 图片。
首次部署仍要上传约 1.1 GB；之后媒体不变，只传变化的 HTML/JS/CSS。

R2 仍然是可选升级（账号当前未开通）；开启后把 `NEXT_PUBLIC_ASSET_BASE`
指过去即可把媒体移出部署包，`src/lib/assets.ts` 已支持这个开关。

**新闻数据仍由 news-refresh 保持新鲜**：`.github/workflows/news-refresh.yml`
每天 01:17 UTC 跑 `npm run news:refresh`，有变更就提交回仓库。它只碰 `data/`，
不需要媒体。部署由 deploy.yml 的 schedule 负责，且 build 自己也会抓一次
AIHOT，所以即使这次提交没有触发部署，站点仍会拿到最新资讯。

`.github/workflows/ci.yml` 跑 assets:check / news 数据校验 / census / test /
lint / tsc / **build**。其中 build 这一步是**检查而非部署源**：CI 检出没有媒体
（`public/assets/{icons,shots,tags,news}` 被 gitignore），产出的 `out/` 直接丢弃；
deploy.yml 是独立的部署 workflow，会在构建前从 Release 快照恢复媒体。CI 实测在
0 个媒体文件下 exit 0（约 5 分钟），而注入一个预渲染错误后会 exit 1 并点名出错
路由——所以它抓代码与渲染回归，**不抓媒体缺失**；那个缺口由 deploy.yml 的
媒体数量检查与 `media:check` 覆盖。

部署细节与回滚见 [DEPLOY.md](DEPLOY.md)，媒体备份还原见 [MIGRATION.md](MIGRATION.md)。

## 与原站的差异（DEVIATIONS）

这个站是从原站逐页复刻的，`src/` 里大量注释在解释「为什么这里和原站不一样」。
收敛成一份清单，省得每次都要 grep：

| # | 差异 | 位置 |
|---|---|---|
| 1 | 新闻页已**不是**原站复刻：2026-10-15 起改为 AIHOT 精选的资讯卡片流，卡片跳原文，站内不再有 `/news/{slug}` 详情页 | `src/app/news/page.tsx`、`scripts/fetch-aihot.mjs` |
| 2 | 工具卡的图标 loading 占位方块（原站是 `next/image` 的解码占位，解码后会移除）不实现——本地图标同步解码，保留会出现永久脉冲灰块 | `src/components/tool-card.tsx` |
| 3 | 工具卡外层 `data-state="closed"` 不输出（Radix 状态属性，原站 CSS 没有任何规则选它） | `src/components/tool-card.tsx` |
| 4 | 「更多AI工具」网格原站是每次渲染重掷的随机抽样，这里改成 slug 的纯函数（同一工具页永远同样网格） | `src/lib/data.ts` 的 `moreTools` |
| 5 | 「类似工具」同理，但保留按品类抽取的关系 | `src/lib/data.ts` |
| 6 | `layout.tsx` 里 `<main>` 套 `<main>` 是无效 HTML，但它是侧栏全高边线对齐的唯一手段，有意保留 | `src/app/layout.tsx` |
| 7 | **没有登录/注册**：原站的账号体系是服务端能力，静态站做不了。2026-10-18 起把页眉右上那个「登录/注册」换成了「我的收藏」→ `/favorites`（本机 localStorage，无需账号）。原按钮点开是一个写着「复刻版本未包含账号系统」的弹窗，是首访最伤信任的一处 | `src/components/header.tsx`、`src/app/favorites/page.tsx` |
| 8 | 404 插图的 `height="auto"` 改为 CSS `h-auto w-[300px]`——SVG 的 width/height 属性不接受 `auto`，原样保留会让浏览器控制台报错 | `src/components/not-found-art.tsx` |
| 9 | 工具页 prose 里指向已删新闻详情页的 `/news/{slug}` 链接降级为纯文本（原站那批长文已随改版下线，站内无等价目标） | `src/components/tool-details.tsx` |
| 10 | 404 页从「原站复刻的一行按钮」改成**三条出路**（搜索全部工具 / 返回首页 / 6 个分类），并修正了 `<title>`（原先是首页标题） | `src/app/not-found.tsx` |
| 11 | 首页主次 CTA 对调：主按钮从「看今天的 AI 资讯」换成「浏览全部工具」——工具导航站的首屏主操作应该是找工具 | `src/components/hero.tsx` |
| 12 | `/tools` 的筛选状态**写进 URL**（`?q=&cat=&tag=&price=`），原先只在挂载时读一次，用户筛选后返回会全部丢失 | `src/components/tools-explorer.tsx`、`src/lib/filter-url.ts` |
| 13 | 搜索从「纯小写子串」改成**意图展开 + 关键词索引**：22 个真实意图词里原先有 6 个零命中（写代码/做视频/论文润色/小红书文案/做网站/电商详情页），现在全部有结果 | `src/lib/search.ts`、`scripts/generate-search-index.mjs` |
| 14 | 新增 `/collections` 的站内入口（首页「编辑精选」条、侧栏、页脚、页眉下拉）——9 个集合原先**全站 0 内链**，只有 sitemap 能到 | `src/components/home-collections.tsx` 等 |
| 15 | 资讯卡片新增「站内收录 · X」chip、工具详情页新增「相关资讯」——原先资讯与工具目录**零互链** | `src/lib/news-links.ts`、`src/components/tool-news-panel.tsx` |
| 16 | 详情页新增「怎么选」面板（适合/不适合/与同类差异/起价），数据来自**人工维护**的 `src/lib/tool-verdicts.ts`；**没有人工条目时降级成「目录事实」版**（同类规模 + 免费占比 + 同类里已有人工判断的 3 个 + 收录快照过期提示），徽章如实区分 | `src/components/tool-verdict.tsx` |
| 17 | 新增 `/offline` 离线页 + Service Worker + 可安装的三档图标（原 manifest 只有 2 个图标、无 192/512/maskable，Chrome 判定不满足安装条件） | `scripts/generate-sw.mjs`、`src/app/manifest.ts` |
| 18 | 缩略图：`/assets/thumbs/` 由 `scripts/gen-thumbs.mjs` 预生成 webp，页面用 `srcSet` 指过去（首页 33 个可见图标 880 KB → 92 KB） | `scripts/gen-thumbs.mjs`、`src/components/tool-card.tsx` |
| 19 | 字体 CSS 从 `globals.css` 的 `@import` 改为 `layout.tsx` 直接 import（去掉一级串行 RTT），删除 12 条全站未使用的 Fraunces `@font-face` | `src/app/fonts.css`、`src/app/layout.tsx` |
| 20 | 列表卡片关闭 Next 的视口内 RSC 预取（2000+ 链接）；长列表加 `content-visibility`；「加载更多」步长 120→60、累计上限 1200 | `src/components/tool-card.tsx`、`src/components/tools-explorer.tsx` |
| 21 | **卡片可比较化**：每张网格卡底部加一行「价格胶囊 / 平台 / 新鲜度」。价格只挂会改变决定的三档（免费/开源/付费）——免费增值 1737 条是多数派不构成区分；新鲜度只在 90 天内说话（88.75% 的条目超一年，把「更新于 2025-10-11」印在每张卡上等于把陈旧包装成卖点） | `src/lib/card.ts`、`src/lib/card-server.ts`、`src/components/tool-card.tsx` |
| 22 | **搜索能接住中文任务语**：新增 `compoundParts()` 拆中文复合词（「公众号排版」→ 公众号+排版）、`COVERAGE_BONUS` 奖励命中更多部件、`PRIMARY_FACTOR` 让用户原话压过同义表别名、同分改按目录序（原先按名字长度，两字名排前面）。实测「公众号排版」的 `135 AI排版助手` 从**不在结果里**变成第 1 | `src/lib/search.ts` |
| 23 | **`/tools` 与分类页/集合页的筛选分层**：`/tools` 有全套筛选（搜索/分类/标签/价格/平台/排序/页码，全写进 URL）；分类页与集合页**只加排序 + 加载更多，刻意不加筛选器**（否则会变成 `/tools?cat=` 的第二个实现，永远漂移） | `src/components/tools-explorer.tsx`、`src/components/category-grid.tsx` |
| 24 | **新增 `/compare` 二选一对比（298 页）**：站内第一个直接回答「这两个该选哪个」的页面。清单由人工 `vs` 字段做语义闸门 + 读者关心度排序算出来，不手挑；三层结构「事实对照表 → 差异高亮 → 编辑判断并排」（事实 100% 有数据、判断 17.4%），所以任何一对都能渲染 | `src/lib/compare.ts`、`src/app/compare/` |
| 25 | **首页首屏加搜索入口**，并把体量数字在移动端搬出 hero：390×844 下第一张工具卡从 top 773 提到 617、露出从 71px 变成完整一张卡 | `src/components/hero-search.tsx`、`src/components/home-stats.tsx` |

`data/tool-extras.json` 里的 `more` / `related` / `latest` 三个字段同样
不参与渲染，只作溯源保留——原因见 `src/lib/types.ts` 的类型注释。

## AI 资讯（/news）—— AIHOT 数据源

2026-10-15 之前，`/news` 是原站十篇长文的复刻。现在改为
[AIHOT](https://aihot.news) 精选的资讯卡片流，因为原站那批文章**停更在 2025-08**
（最新一篇 2025-08-14），而栏目还挂在导航上。

```bash
npm run news:fetch     # 增量抓取（带 ETag，304 就不重写）
npm run news:refresh   # 强制重抓
```

`npm run build` 的第一步就是 `node scripts/fetch-aihot.mjs`，所以正常构建
不需要手动跑。

**接口用 v1，不是旧接口。** AIHOT 的旧接口 `/api/public/*` 与旧域名
`aihot.virxact.com` 已于 **2026-10-31 停服**（原定 12-31，官方提前），
新接口是 `https://aihot.news/api/v1`，参数名也变了（`take`→`limit`、
`since`→`window`）。抓取脚本直接对齐 v1，不做旧接口兼容。

**字段映射**（v1 → `data/news.json`）与**署名要求**：见
`scripts/fetch-aihot.mjs` 顶部注释。要点是 `source` / `aihotUrl` /
`originalUrl` 三个字段必须保留并展示——AIHOT《公开使用规则》v1.1 第 5、6 条
禁止删除或伪造机器响应里的来源与 canonical 信息。

**使用授权**：规则第 3 条允许「个人非商业、公益非商业、组织内部使用」免费直接使用；
第 4 条要求「对外商业产品、收费服务、广告或赞助业务、批量再分发」**先取得书面授权**。
本站定位为非商业，**不接广告**（`AdSlot` 保持占位不配置），据此属于可直接免费使用。
若日后要商业化，须先向 AIHOT 申请授权再上线。

**失败不影响构建**：抓取失败时保留上一版 `data/news.json` 并 exit 0（只在既抓不到
又没有历史数据时才 exit 1），所以断网不会把站点构建搞挂。抓取时间与 ETag 记在
`data/aihot-meta.json`。

**已知取舍**：AIHOT 不提供配图，卡片是纯文字的；`public/assets/news/` 里那 11 张
旧长文封面已无引用（仍在磁盘与备份包里）。

### 频道结构（2026-10-17 起）

`/news` 不再只是一张列表，而是一个有五个分区的栏目，顶部的粘性分段控件
（`src/components/news-tabs.tsx`）把它们串起来：

| 分区 | 路由 | 内容 |
|---|---|---|
| 资讯流 | `/news` | 近 7 天精选卡片流，客户端搜索 / 分类 / 来源 / 时间筛选 |
| AI 日报 | `/news/daily` | 每日 08:00（北京时间）出刊，逐期静态页 + 全部往期归档 |
| 周报 | `/news/weekly` | 每周回顾 |
| 月报 | `/news/monthly` | 每月回顾 |
| 热点 | `/news/hot` | 跨来源信号量的十条热点榜 |

日报、周报、月报的**每一期**都是构建期预渲染的独立静态页（`generateStaticParams`
读出全部日期），所以可以收藏、分享具体某一天。归档页 `/news/daily/archive`
按月分组列出全部 179 期。

数据在 `npm run build` 里由两个脚本抓取：

```bash
node scripts/fetch-aihot.mjs        # 资讯流 → data/news.json
node scripts/fetch-aihot-daily.mjs  # 日报/周报/月报/热点 → data/aihot-daily.json
```

第二个脚本是**增量**的：已抓过的日报正文不重抓（按日期复用上一份数据），
只有新出刊的日期才会发请求，避免每天 179 次请求打到 AIHOT。接口限流 429 时
保留旧数据并 exit 0，断网不会把构建搞挂。

`data/aihot-daily.json` 约 2 MB，只被 `src/lib/daily-data.ts`（server-only）
读取，不会进客户端 bundle；资讯卡片流用的 `data/news.json` 才随页面下发。

## 已知问题

- **媒体不在 git**：本机一份 + `D:\tryworld-backups\` 归档 + GitHub Release 的 `assets.tar.gz`（deploy.yml 用它恢复）。定期跑 `npm run media:backup`；媒体变化后要发新 release 并更新 `MEDIA_VERSION`，否则部署会因 `media:check` 失败而中止。（2026-10-15 核对：备份包 4183 个文件与磁盘**逐文件一致**，抽样解压 SHA256 相符。）
- **`llms.txt` / `llms-full.txt` 的域名已改写**：`data/llms.txt` 是原站索引，47 个绝对链接都指向 `tryworld.com.cn`，生成时统一改成本站，否则等于给原站导流。`llms-full.txt`（8.3 MB）由 `scripts/generate-llms-full.mjs` 生成并挂进 `npm run build`，不会再出现 robots 声明了却 404 的情况。
- **首页 HTML 5.86 MB 是磁盘大小，不是访客下载量。** 2026-10-16 实测（Chromium，线上）：
  首页 Brotli 传输 **167 KB**、整页首次加载 **364 KB / 14 个请求**；1496 张图**全部
  `loading=lazy`**，首屏只加载 2 张。完整滚到底：移动端 390×844 传 **4.2 MB**（203 张图，
  2.27 MB），桌面端 1440×900 传 **4.15 MB**。也就是说首屏没有风险，代价在**深度滚动**——
  平均每张截图 149 KB 且没有 `srcset`，所以高分屏拿到的是比显示尺寸大得多的原图。
  真要优化就从 `srcset` + 预生成缩略图入手，不是"首屏"问题。（本节早先写"移动端首屏是
  明确风险"，那是只看未压缩字节得出的错误结论，已按实测更正。）
- **`.txt`（RSC flight）2135 个占 240 MB**：`npm run prune` 的 `--lean` 可裁掉，但会保留 `llms.txt` / `llms-full.txt`（两者由 robots.txt 声明，删了就是 404）。
- **测试**：114 个（2026-10-22）。单元 87 条（`npm run test:unit`：时区格式化、AIHOT
  字段映射与降级、22 个搜索意图词 + 中文复合词拆分 + 覆盖率排序、收藏存储 v1→v2、
  筛选 URL 往返、卡片排序与新鲜度），产物断言 19 条
  （`tests/app-shell.test.mjs`，读 `out/*.html`，含「layout chunk 不得含目录数据」的体积守卫），
  交互 8 条（`npm run test:interaction`，需先 `npm run preview`）。
  仍无测试的：`lib/data.ts` 的确定性抽样、`lib/news-links.ts` 的匹配规则。
  CI 已跑 lint / tsc / test / census / assets:check / **gen:check** / **verdicts:check** / build。
  两条「两份实现不许漂移」的守卫：`sortCards()` 与 `sortRecords()` 在真实数据上前 60 条的
  顺序必须逐项相同（`tests/card.test.mjs`）——不是靠注释提醒，是靠测试拦住。
- `package.json` 的 `name` 是 `tryworld-portal`，与仓库名、Worker 名不一致。
- eslint 9 仍用 `FlatCompat` 桥接 `next/core-web-vitals`（官方已弃用的接法）。
- **首屏仍有一半是字体**：实测首页桌面 2104 KB 里 Font 999 KB（47.5%），18 个 woff2
  分片，全部是 Noto Sans SC 的可变字体 unicode-range 切片。再往下压需要裁分片或
  按站点实际用字做子集化，属于独立的字体工程，本轮没做。
- **RSC 预取仍是第二开销**：首屏 669 KB（31.8%）来自视口内链接的 `.txt?_rsc=` 预取
  （`/tools.txt` 单条 117 KB）。工具卡已关预取，剩下的是侧栏、分类索引、导航这些
  真正在首屏的链接 —— 关掉会让点击变慢，属于取舍不是 bug。
- **「怎么选」覆盖 363/2081（17.4%）**，26/26 分类的 rank 1–12 全覆盖。
  没有人工条目的 1718 个页面**不再整块消失** —— 渲染层降级成「目录事实」版
  （同类规模 + 免费占比 + 同类里已有人工判断的 3 个 + 收录快照过期提示），
  徽章如实写「目录事实」而不是「编辑判断」。降级块**不写任何适合/不适合推断**
  （那需要人工判断，编造一条比不写更伤信任）。继续填充见 `npm run verdicts:draft`。

## 数据可信度

`node scripts/census.mjs` 输出当前抓取口径的普查：每个字段的覆盖率、
pricing 徽章分布、`more/related/latest` 的死引用数、prose 总字符数。
`src/lib/types.ts`、`src/lib/pricing.ts`、`src/lib/data.ts` 里的覆盖数字
抄自它的输出，重新抓取后请重跑一次再改注释。
`npm run census` 也会核对媒体文件数（4188 个 / 327 MB），
改 `scripts/sync-assets.mjs` 注释前先跑它。

## 已验证

`npm run build` 通过（2632 页静态生成，产物 2632 个 `.html`），
`npm run lint` exit 0、`npx tsc --noEmit` exit 0。每个路由都带上了
`<link rel="canonical" href="https://nav.tryworld.com.cn/...">`，
`npm run prune --lean` 保留 `llms.txt` 与 `llms-full.txt`。

2026-10-22 线上验收（部署 Version `37fa2cdb`，本轮）：

- **构建与测试**：`npm run lint` 0 错 / `npx tsc --noEmit` 0 错 /
  `npm test` **114/114** / `npm run build` 成功 / 2632 个静态页。
- **部署**：`Uploaded 2636 files (10701 already uploaded)`，487 秒。
  内容派生的 buildId 生效 —— 只传变更部分，不是全量 13389 个。
- **路由**：15 条关键路由全部 200（含 `/compare` 与 `/compare/cursor-vs-otty`）；
  sitemap 抽样 30 条 **30/30 返回 200**；媒体抽样 30 个 **30/30 返回 200**。
- **渲染**：15 个页面 × 2 视口（390×844 / 1440×900）= **30 次加载，零问题** ——
  `h1` 恰好 1 个、`scrollWidth == clientWidth`（零横向溢出）、
  canonical 齐全、**零 4xx、零 pageerror**。
- **预取 404 已消除**：修复前首页加载 24 个 `.txt?_rsc=` 404、每次导航再 +22；
  修复后**全新上下文 4 次页面加载 0 个 4xx**（`work/prefetch-cost.mjs`、
  `work/fresh404.mjs`）。原因与取舍见 `next.config.mjs` 里那段说明。
- **内容抽查**：首页首屏搜索入口在、卡片新鲜度 56 处、
  详情页降级块（「目录事实」）与人工条目（「编辑判断」）都在。
- 备注：本机部署线路有约 40% 连接超时率，**三次里成一次是常态**
  （本轮第 1 次卡在清单读取、第 2 次成功）。判据是 CPU 与 TCP 连接，
  不是日志有无输出 —— 详见 [DEPLOY.md](DEPLOY.md)。

2026-10-17 夜间验收（资讯频道 + APP 壳）：

- **构建**：`npm run build` exit 0，静态页 **2340** 个（上一轮 2135）。
- **测试**：`npm test` **46/46 通过**；`tests/interaction.test.mjs` 新增的
  「资讯频道所有页面在 320/390/1440 下都无横向滚动」通过。
- **横向溢出**：修复前手机 390px 下 `/news/daily` 的 `scrollWidth` 是 **765px**
  （半页被推出屏幕），`/news/daily/2026-10-17` 694px，桌面 1440 下 7 个资讯页
  各溢出 32px。修复后 **10 个页面 × 3 档视口全部 `scrollWidth == clientWidth`**。
  三处根因（正文列 `min-width:auto`、`-mx-4` 出血无裁剪、`grid` 未写
  `grid-cols-1`）都已写进对应文件的注释，避免后人改回去。
- **水合**：Playwright 跑 10 条路由 × 2 视口，`pageerror` 与 console error
  均为 **0**。本轮修掉的真实缺陷是 `/categories` 的 `<a>` 嵌套 `<a>`
  （无效 HTML，浏览器解析时拆开外层锚点，报 `Minified React error #418`）。
- **触控目标**：移动端所有导航/翻页/筛选控件 ≥ 24px；正文内的行内链接
  （AIHOT 署名、来源名）保持文字尺寸，符合 WCAG 2.5.8 的行内例外。
- **PWA**：`manifest.webmanifest` 导出、`display: standalone`、
  `viewport-fit=cover`、iOS `apple-mobile-web-app-*` 元数据齐全。

2026-10-17 部署后线上复验（Version `918db0db`，资讯频道上线）：

- **版本**：`918db0db-0ca8-4896-9413-092bc8d6587e` 已 100% 接流；
  本次增量上传 **364 个**文件（8751 个已存在被复用），耗时 170 秒。
- **路由**：15 条抽样全部 200 —— 含最新一期/较早一期日报、日报归档、周报、
  月报、热点、`sitemap.xml`、`robots.txt`、`manifest.webmanifest`、`llms.txt`。
- **渲染**：320/390/1440 三档视口 × 11 条页面，`pageerror` 与 console error
  均为 **0**；每页 `h1` 恰好 1 个；全部页面带 canonical；移动端底部 Tab 栏在位。
- **横向溢出**：线上实测 `scrollWidth == clientWidth`，**0 页溢出**。
- **内容**：资讯页外链原文且带 `AIHOT` 署名；抽样 14 个 JS/CSS/媒体资源
  全部 200（媒体未因发布丢失）。
- **manifest**：线上 `display=standalone`、2 个图标、`lang=zh-CN`。
- 备注：本机 DNS 把域名解析到代理网卡（`198.18.x`），Chromium 默认优先
  IPv6 会 `ERR_TIMED_OUT`，验收脚本用 `--dns-result-order=ipv4first`；
  这不影响真实访客。

2026-10-15 部署后复验（Version `c5355d01`，补 SEO 与 llms 修复）：

- `llms-full.txt` 由 404 转为 **200 / 8,516,507 bytes**（robots.txt 早已声明它）
- `llms.txt` 47 条链接全部指向本站，指向原站 `tryworld.com.cn` 的为 **0**
- canonical 在 `/`、`/tools`、`/news`、`/categories`、`/collections`、`/about`、
  `/tools/[slug]`、`/privacy-policy` 全部存在
- 媒体未丢失：随机抽样 120 个 `/assets/*` **120/120 返回 200**
- 路由健康：sitemap 中随机抽 60 条 **60/60 返回 200**
- 交互正常：`/tools` 客户端筛选 2081 → 搜「视频」334 → 重置 2081 → 点分类 34，
  浏览器 `pageerror` **0**

2026-10-15 部署后复验（Version `b4c66c4d`，接入 AIHOT 资讯）：

- `/news` 渲染 **109 张卡片**，109 条链接**全部为外链原文**、全部
  `target=_blank` + `rel=noopener noreferrer`
- 署名完整：`来源：<来源站>` 与 AIHOT 出处说明均在页面上（合规要求）
- 无 ISO 时间泄漏（时间已按 `Asia/Shanghai` 格式化）
- 旧详情页 `/news/{slug}` 返回 **404**；sitemap 由 2134 条降为 **2124 条**，
  不再收录资讯条目
- 媒体回归：120 个 `/assets/*` **120/120 返回 200**
- 回归路由 `/`、`/tools`、`/categories`、`/collections`、`/about`、`/privacy-policy`
  全部 200，**破图 0**，`pageerror` **0**

抓取降级也已实测：把 API 指向不可达主机后，有历史数据时打印警告并 **exit 0**
（保留上一版 109 条，构建继续）；删掉 `data/news.json` 后再测才 **exit 1**。

2026-10-16 对抗式回归（桌面 1440×900 + 移动 390×844 两套视口，逐控件点击）：

- **穷举内部链接**：2125 个页面里 **316,029** 个内部引用，断链 **0 个**
- **移动端修复**：汉堡菜单原先**完全打不开**（见下方"已修缺陷"），修复后面板
  正常弹出、含 3 个导航入口 + 常用推荐 + 22 个热门分类，关闭按钮 / Esc / 点链接
  导航三种关闭路径都可用
- **桌面端**：所有分类面板开合、登录弹窗开合、搜索弹窗（Ctrl+K）选中后跳转并
  关闭、`/tools` 筛选全链路（输入→334、清空→2081、分类→34、重置→2081、加载更多）、
  分享/收藏按钮状态切换与 localStorage 写入
- **深链接**：`/tools?q=视频` 与 `/tools?cat=ai-coding` 进入后筛选态正确回填
- **后退键**：在筛选过的 `/tools` 上返回，状态与 URL 一致（`?cat=ai-coding`，136 个）
- **404 页**：三种视口（390×844、320×568、1440×900）下按钮均可见可点、无横向滚动
- 全流程 `pageerror` 与 console error 均为 **0**

### 已修缺陷（2026-10-16 对抗测试发现）

| 缺陷 | 影响 | 根因 |
|---|---|---|
| **移动菜单完全打不开** | 移动端唯一的主导航入口失效——点汉堡按钮页面纹丝不动 | `mobile-nav.tsx` 里 `useEffect(() => onClose(), [pathname, onClose])` 在**挂载时也会执行一次**，菜单刚开就被关掉，DOM 里面板只存在一帧 |
| **404 插图控制台报错** | 每次访问 404 都有一条 `Error: <svg> attribute height: Expected length, "auto"` | 原站写 `height="auto"`，而 SVG 的 width/height 属性不接受 `auto` |
| **工具页残留 404 链接** | `/tools/bing-image-creator` 的 prose 里指向 `/news/how-to-use-bing-create-images`，该路由已随新闻改版删除 | 删详情页时未检查 prose 内的引用；已在渲染层降级为纯文本 |

第一个缺陷**只在移动端出现**，桌面端一切正常（"所有分类"面板是 header 内联渲染的，
不走那个组件）——所以只做桌面测试会完全漏掉。这也是为什么回归测试按视口分开跑。

两个修复都做了**反向验证**：把代码回滚到有 bug 的版本后，测试确实 FAIL
（`AssertionError: 菜单应出现`），修复后 5/5 PASS。测试不是空转的。

## 快速开始（命令速查）

```bash
npm run build       # 约 4 分钟：先抓 AIHOT 资讯，再生成 llms-full.txt，最后 next build
npm run lint        # eslint，当前 exit 0
npm run news:fetch  # 只抓资讯（增量，带 ETag）
npm run news:refresh # 强制重抓资讯（绕过 ETag）
.\scripts\deploy.ps1 # 推荐：build + 守卫 + prune + 部署（带重试）。见 DEPLOY.md
npm run census      # 重算数据口径的普查数字
```
