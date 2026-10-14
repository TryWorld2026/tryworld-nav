# 迁移 / 备份 / 恢复

这个项目有四类东西，分布在不同地方。迁移前先确认四类都在。

| 类别 | 大小 | 在哪 | 迁移方式 |
|---|---|---|---|
| 代码 + 配置 | 27 MB | git 仓库 | `git clone` |
| 数据（`data/*.json`） | 17 MB | git 仓库 | 跟着 clone 走 |
| **媒体**（产品图标/截图） | **336 MB** | **不在 git** | 见下 |
| Cloudflare 侧配置 | — | 账号内 | `wrangler.toml` 在 git 里，部署时自动生效 |

## 媒体为什么特殊

`public/assets/{icons,shots,tags,news}` 是 4188 个文件、336 MB。GitHub 超过 1 GB 会警告、单文件超 100 MB 直接拒绝，而且每次 CI checkout 都要下载整个目录 —— 所以它不进 git。

它目前有三份：

1. **本机** `D:\codingXM\工具平台\public\assets\`
2. **归档** `D:\tryworld-backups\assets-<日期>.tar.gz`（292 MB）
3. **线上** https://nav.tryworld.com.cn/assets/... （部署时打包进了 Worker）

任何一份都足够重建整个站。

## 日常备份

```bash
npm run media:backup          # → D:/tryworld-backups/assets-<今天>.tar.gz
npm run media:backup E:/移动硬盘/tryworld   # 指定目录
```

默认写到 `D:/tryworld-backups`（另一块物理盘），丢一块盘不至于两份都没。**这个归档请再复制一份到你平时备份的地方** —— 它是唯一完整的本地副本。

加了新工具、或者重新抓过图之后跑一次。

## 换机器 / 重建

```bash
git clone <你的仓库> tryworld-nav && cd tryworld-nav
npm ci

# 三选一还原媒体：
npm run media:restore -- --from D:/tryworld-backups/assets-2026-10-14.tar.gz   # 归档
npm run media:restore -- --from https://nav.tryworld.com.cn                     # 线上（4188 个文件，慢）
npm run media:restore -- --from r2:tryworld-nav-assets                          # R2（需要先开）

npm run build
npm run deploy
```

`--force` 可以强制重新下载已存在的文件，不加则跳过本地有的（中断后可续）。

## 换 Cloudflare 账号 / 换域名

1. `wrangler.toml` 里的 `name`（Worker 名）和 `routes`（自定义域名）—— 改这两处
2. `src/lib/data.ts` 的 `SITE.url` —— sitemap、robots.txt、og:url 全跟随
3. `npx wrangler login` 登新账号，`npm run deploy`

域名换了之后，线上那份媒体也跟着新域名走，`media:restore --from https://新域名` 依然可用。

## 搬去别的托管商

站点是全静态导出（`output: 'export'`），`out/` 就是一堆文件。理论上任何静态托管都能放：

```bash
npm run build && npm run prune
# 把 out/ 传给 Netlify / Vercel / GitHub Pages / 自己的 nginx
```

要注意两点：

- **`prune` 会裁掉 R2 媒体**，所以搬到不使用 R2 的托管商时，要么不裁（部署带媒体），要么先把媒体传上去再设 `NEXT_PUBLIC_ASSET_BASE`
- **扩展名映射**：Next 生成 `tools/x.html`，链接是 `/tools/x`。Cloudflare、Netlify、Vercel 都会自动映射；裸 nginx 需要配 `try_files $uri $uri.html`

## 现在还没做的

**R2 没开**，所以媒体是打包在 Worker 里部署的。开了 R2 之后：

- 部署从 1.2 GB / 8,671 文件降到几十 MB / 2,382 文件
- CI 自动部署才能安全打开（否则会删掉线上所有图）
- `media:restore --from r2:...` 成为标准还原路径

开法：Cloudflare 控制台 → R2 → Enable R2（要绑支付方式，免费额度 10 GB/月），然后 `npm run assets:push`。
