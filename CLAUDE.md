# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目

「试界导航」(tryworld-nav)：AI 工具导航站，2081 个工具 / 26 个分类 / 2340 个预渲染页面。
Next.js 15.5 App Router + React 19 + Tailwind 3.4，**纯静态导出**，部署到 Cloudflare Workers
Static Assets。<https://nav.tryworld.com.cn>

## 常用命令

```bash
npm run dev                 # next dev，不跑抓取脚本
npm run build               # 抓 AIHOT → llms-full → gen:all → sw → next build（8–11 分钟）
npm run lint                # eslint .（不是 npx eslint src —— 那是解析不到 executable 的旧坑）
npx tsc --noEmit            # 类型检查，CI 里单独一步
npm test                    # node --test，全部测试
npm run test:unit           # news / fetch-aihot / search / favorites / filter-url（不含交互与产物）
npm run test:interaction    # Playwright 交互回归，需先起服务器，否则自动 skip
npm run preview             # npx serve out -l 3100（interaction 测试默认连这个地址）
npm run census              # 重算数据口径（覆盖率、pricing 分布、死引用、媒体文件数）
npm run gen:all             # 重算客户端用的 nav.json 与 search-index.json（改了数据就跑）
npm run gen:check           # 校验上面两份生成物是否与数据源一致（CI 用）
npm run gen:thumbs          # 生成缩略图（可选，未生成时页面回退原图）
npm run gen:pwa-icons       # 从 icon.svg 重新生成 192/512/maskable 图标
npm run verdicts:check      # 校验「怎么选」判断数据的 schema
npm run verdicts:draft      # 从 prose 抽价格/场景候选到 work/verdict-drafts.md（人工审阅）
npm run deploy              # build + 守卫 + prune + wrangler deploy
```

**跑单个测试文件 / 单条用例：**

```bash
node --test tests/news.test.mjs
node --test tests/search.test.mjs
node --test --test-name-pattern="北京时间" tests/news.test.mjs
node --test --test-name-pattern="汉堡菜单" tests/interaction.test.mjs   # 需先 npm run preview
```

**不要用 `npx eslint src`**，用 `npm run lint`。测试用 `node --test`，没有 jest/vitest 依赖。
`work/` 与 `public/sw.js` 已在 eslint ignore 里（一次性分析脚本与生成产物）。

### 2026-10-18 新增的两份**生成物**（改数据后必须重跑）

客户端组件不能 import `@/lib/data`（那会把 2081 条目录打进 layout chunk，
每个页面白付约 182 KB br）。所以把客户端真正需要的东西抽成两份生成物：

| 文件 | 生成脚本 | 内容 | 体积 | 谁用 |
|---|---|---|---|---|
| `data/nav.json` | `scripts/generate-nav.mjs` | 26 分类 / 5 推荐（href 构建期解析好）/ 9 标签 | 5 KB（br 1.4 KB） | 页眉、移动抽屉、侧栏、搜索面板、页脚 |
| `data/search-index.json` | `scripts/generate-search-index.mjs` | 2081 条 `{slug,name,desc,icon,cats,tags,keywords}` | 398 KB（br 68 KB） | 命令面板、`/tools` 筛选、资讯的「站内收录」chip |

- 两者都**进 `contentBuildId()` 的输入清单**（`next.config.mjs`），否则「只改了索引」
  不会换 buildId，浏览器缓存会命中旧 chunk。
- `data/search-index.json` 的 `keywords` 由 `src/lib/search.ts` 里的 `LEXICON` 扫 prose 得到，
  生成脚本还有一道 `MAX_DF=300` 的文档频次上限——出现超过 300 次的词（营销、报告、识别）
  对排序是噪音、对体积是灾难，会被整体剔除。
- **改完 `data/tools.json` / `featured.json` / `tags.json` / `categories.json` 一定要跑
  `npm run gen:all`**，否则页面上的分类名与搜索结果是旧的。CI 的 `gen:check` 会拦。

### 收藏（`/favorites`）—— 本机，不是账号

- 存储键 `tryworld:favorites`，**v2 结构** `{version:2, items:[{slug,name,description,icon,category,addedAt}]}`。
- **必须兼容 v1**（纯 `string[]`，2026-10 之前写入的）：`lib/favorites.ts` 的 `parseStore`
  读到数组会转成只带 slug 的条目，下次写入自动升级。改动这里务必保留这条路径，
  否则老用户的收藏会被静默清空。
- 全站唯一入口：页眉右上「我的收藏」、侧栏、页脚、页眉分类下拉底部、移动抽屉。
  详情页的「添加收藏」通过 `tryworld:favorites-changed` 自定义事件与收藏页联动
  （`storage` 事件只在跨标签页触发，同 tab 内不生效）。
- 数据不上传、不需要账号，隐私政策里如实写明。

### 「怎么选」判断数据（`src/lib/tool-verdicts.ts`）

- **人工维护，不是抓取产物**。字段：`bestFor / notFor / diff / vs / price / confidence`。
- 详情页的 `<ToolVerdict>` 在该工具没有条目时**整块不渲染**，所以 2081 页里没写到的
  那些零回归。
- 为什么必须人工：这里写的是缺点、同类对比、起价，编造一条比不写更伤信任。
  `scripts/draft-verdicts.mjs` 只把候选写到 `work/`，**绝不写 data/**。
- 新增条目跑 `npm run verdicts:check`：它会校验 slug 存在、日期不是未来、长度上限等。

### PWA 与离线

- `public/sw.js` 由 `scripts/generate-sw.mjs` 生成（经典脚本，零 import），
  `npm run build` 里会跑。编译期版本号是**模板内容哈希**（不是随机），所以没改逻辑时
  不会留下无意义的 diff。
- 策略：`_next/static` / `/fonts/` / `/assets/thumbs/` cache-first；导航 network-first，
  失败回退 `/offline`，再失败用内联兜底 HTML。**不缓存 HTML**（页面写死 buildId，
  缓存旧 HTML 会在部署后白屏）。
- `src/components/sw-register.tsx` 只在 `https:` 下注册，本地 http 不注册。
- 图标三张（192/512/maskable）用 `scripts/gen-pwa-icons.mjs` 从 `icon.svg` 生成，
  **进 git**（`public/assets/site/` 未被 gitignore）。

---

## 架构

### 静态导出的硬约束


`next.config.mjs` 设 `output: 'export'`：**没有服务端**。任何路由碰到
`searchParams` / `cookies()` / `headers()` / Node 内建模块都会让构建失败。

- 客户端筛选读 `location.search`，见 `src/components/tools-explorer.tsx` 的 `useUrlFilter`。
- 动态路由（`/tools/[slug]`、`/news/daily/[date]` 等）必须导出 `generateStaticParams`。
- `src/app/sitemap.ts`、`src/app/manifest.ts`、`src/app/robots.txt/route.ts` 需要
  `export const dynamic = 'force-static'`，否则 Next 会当成请求期路由而不产出文件。
- `images.unoptimized: true`：没有 Node 图片优化器，`next/image` 直接输出原图。

### 数据流

```
data/*.json  →  src/lib/data.ts  →  页面 / 组件
             →  src/lib/daily-data.ts  →  /news/daily|weekly|monthly|hot
```

- **`src/lib/data.ts` 是唯一取数入口**，把 JSON 读成内存表并导出 `Map`（`toolBySlug` 等）。
  它约 7 MB，**绝不能进客户端 bundle**。
- 两个防泄漏的拆分：
  - `src/lib/tags.ts` —— `ToolMiniCard` 在客户端渲染，只需要 3 KB 的 `tags.json`，
    所以它直接 import tags 而不是 `lib/data`。
  - `src/lib/daily-data.ts` —— 2 MB 日报数据只给服务端组件。
- `data/tool-extras.json`（14 MB prose）只被 `extrasBySlug()` 读取，烘焙进各页 HTML。
- 所有 `/assets/…` 路径走 `src/lib/assets.ts` 的 `asset()`，它按 `NEXT_PUBLIC_ASSET_BASE`
  拼接媒体主机（为将来迁到 R2 留的开关，当前未启用）。

### 内容容器：`.content-container`

**全站只有一个内容宽度 token**，定义在 `src/app/globals.css` 最末尾：
`max-width: 1280px`，移动 1rem / ≥1024px 2rem 内边距。

它**刻意放在所有 `@layer` 之外**——`@layer components` 的优先级低于 `@layer utilities`，
而 Tailwind 的 `px-*` / `max-w-*` 都在 utilities 里，会覆盖掉它。第一次改完实测宽度
纹丝不动就是这个原因。新页面直接用 `.content-container`，不要再造容器。

（`globals.css` 里的 `.brand-container` 是原站遗留的 1536px 容器，现已无调用点，
只是尚未删除。）

### Tailwind 两个静默失效的坑

1. **透明度修饰符必须是默认刻度里的值**（0,5,10,…,100）：`border-foreground/8`、
   `bg-background/92` 这类值**不产出任何 CSS**，那条边框/底色会直接消失，控制台也不报错。
   要么改成 `/10`、`/90`，要么用方括号写任意值 `bg-foreground/[0.03]`（代码里两种都在用，
   但普通修饰符别写非 5 的倍数）。
2. **`text-*` 色相类是运行时拼的**，扫描器看不见，所以 `tailwind.config.ts` 的 `safelist`
   用正则放行 22 色相 × 4 档——改分类色板前先看那段注释。

### 主题与品牌

- 色板经 `globals.css` 的 HSL 变量 → `tailwind.config.ts` 的 `hsl(var(--x))` 映射，
  所以用 `bg-background` / `text-foreground` / `border-border`，不要写死 hex。
- 品牌四色：纸 `#F2EEE6` / 墨 `#1B2523` / 绿 `#24564E` / 橙 `#F2693C`。
- **禁紫色**——品牌没有定义。历史上原站的紫罗兰链接、`purple-*` pricing 徽章、
  紫橙渐变都已被替换；新增任何颜色前先确认在色板内。
- **单主题**：没有 `ThemeProvider`、没有 `darkMode` 分支。`tailwind.config.ts` 里的
  `darkMode: 'class'` 是原站遗留，`<html>` 从不加 `dark`。
- `.ink-band`（`@layer utilities`）是全站唯一的强对比墨色面，用于 hero、资讯报头、
  日报头条。不要在其他地方自造深底。
- 字体：Noto Sans SC 是 100–900 **可变字体**，所以 `font-weight: 650` 合法且是标题默认档；
  Fraunces 只用于英文点题。字体在 `public/fonts/`，通过 `@import` 引入。

### buildId 与部署

`next.config.mjs` 的 `contentBuildId()` 用 `src/` + 指定数据文件 + 配置算 sha256 前缀。
**这不是洁癖**：Next 默认的随机 buildId 会写进每个 HTML，导致 4255 个文件字节全变，
Cloudflare 按内容哈希判定就得全量重传（实测 51 分钟）。内容派生的 buildId 让没变的
文件不上传（实测 24 秒）。

- 改 `contentBuildId()` 的输入清单要同时考虑：**进页面的必须算，每次构建都变的必须排除**
  （`data/aihot-meta.json` 的 `fetchedAt` 已被显式排除，`aihot-daily.json` 里的
  `fetchedAt` 用字符串替换剥掉）。
- 部署用 `scripts/deploy.ps1`，**不要手敲 `npx wrangler deploy`**：脚本固化了「不用管道
  （会静默卡死在 Building list of assets）」「媒体守卫（<4000 文件即中止）」「buildId
  稳定性检查」「失败重试」四件事。详见 `DEPLOY.md`。
- 媒体（`public/assets/{icons,shots,tags,news}`，约 4000 文件）**不在 git**。
  Workers Static Assets 每次部署整体替换清单，所以从 CI 部署会把线上图片全打成 404——
  `.github/workflows/deploy.yml` 因此只有 `workflow_dispatch`。

### AIHOT 数据管线

`npm run build` 的前三步就是抓取，正常构建不需要手动跑：

```
scripts/fetch-aihot.mjs        → data/news.json        （资讯流，ETag 增量）
scripts/fetch-aihot-daily.mjs  → data/aihot-daily.json （日报/周报/月报/热点，按日期增量）
scripts/generate-llms-full.mjs → public/llms-full.txt  （8 MB，gitignore）
```

- **抓取失败不阻断构建**：有历史数据时警告 + `exit 0`，只有既抓不到又没有历史数据才 `exit 1`。
- 接口是 `https://aihot.news/api/v1`（旧接口与旧域名已于 2026-10-31 停服）。
- AIHOT《公开使用规则》要求保留 `source` / `aihotUrl` / `originalUrl` 三个字段并展示，
  **不能删也不能伪造**。`.github/workflows/ci.yml` 有一道字段形状检查守着这点。
- 站内没有 `/news/{slug}` 详情页；资讯卡片直接外链原文。

### 时间与本地化

所有时间按 `Asia/Shanghai` 格式化，一律走 `src/lib/news.ts` / `src/lib/news-period.ts`
的 `Intl` 函数，**不要 `iso.slice(0,10)`**——那是 UTC 日期，北京时间下会差一天且页面上看不出来。

`YYYY-MM-DD` 形式的日期键（日报 `date`、周报 `periodStart`）是「北京日历日」，
手工拆 Y/M/D，不要 `new Date('2026-10-17')`（按 UTC 午夜解析）。

### 组件约定

- `src/components/` 里的组件多是从原站复刻的，注释普遍写明「哪里与原站不同」「为什么」。
  改之前先读注释，很多地方看起来冗长但都是踩过的坑（见 README 的 DEVIATIONS 表）。
- 动效全部尊重 `prefers-reduced-motion`：`globals.css` 有全局降级规则，
  `.reveal` / `.page-enter` 另有自己的兜底。
- 滚动入场用 `<Reveal>`（`IntersectionObserver`），不要用纯 CSS `animation`——
  静态导出下首屏之外的动画会在读者滚到之前就跑完。
- 根目录的 `COORDINATION.md` 是 2026-10-17 与 Codex 并行开发时的一次性分工板，
  **不是长期约定**；除非用户再次安排并行协作，否则以本文件为准。

## 新页面清单

1. `export const dynamic = 'force-static'`（若需要）
2. `...canonical('/path')` 合并进 `metadata`
3. `src/app/sitemap.ts` 里登记
4. 用 `.content-container` 而不是自造宽度
5. 移动端底部预留 `pb-tabbar`（全局已有，新容器别覆盖掉）

## 验收标准

`npm run lint` / `npx tsc --noEmit` / `npm test` / `npm run build` 全过。
CI（`.github/workflows/ci.yml`）跑 assets:check / news 字段校验 / census / test /
lint / tsc / **build**——其中 build 是**检查而非部署源**，它在无媒体的检出上跑，
抓的是 lint 与 tsc 抓不到的预渲染错误。

## 容易踩的坑（按出现频率）

| 现象 | 原因 |
|---|---|
| 某条边框/底色"没生效" | 用了 `/8`、`/92` 这类非法透明度修饰符，CSS 根本没生成 |
| 宽屏下内容被拉到 1728/2368px | 漏了 `.content-container`，或自造了容器 |
| 手机上一半页面被推出屏幕 | flex 子项缺 `min-w-0`（默认 `min-width:auto`），或 `grid` 没写 `grid-cols-1` |
| 改完 `.content-container` 宽度纹丝不动 | 规则被放进了 `@layer`，被 utilities 覆盖 |
| 构建 exit 1，报 `Failed to build /page` | 单页导出超过 60s，通常是本机负载问题，**重试即可**，不是代码错误 |
| 部署要传 700 MB / 50 分钟 | `contentBuildId()` 的输入混进了每次都变的东西 |
| 日期差一天 | 用了 `slice(0,10)` 或 `new Date('YYYY-MM-DD')`，没走 `Asia/Shanghai` 格式化 |
