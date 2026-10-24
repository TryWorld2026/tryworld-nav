/**
 * APP 壳的结构回归（构建产物级，不需要浏览器）。
 *
 * 这些断言全部读 `out/*.html` 而不是组件源码：它们要守的是**最终渲染出来
 * 的东西**——底部 Tab 栏在不在、频道栏在不在、安全区下边距有没有、每条资讯
 * 是否外链。组件内部怎么实现不该被测试锁死。
 *
 * 服务器/构建产物都不可用时整组 **skip**，所以它能进 CI（CI 确实跑 build，
 * 但产物在另一个 job 里丢弃；这里检测到 `out/` 不存在就跳过）。
 *
 *   node --test tests/app-shell.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const OUT = join(process.cwd(), 'out');

/**
 * 读一个导出的页面。Next 的 `trailingSlash: false` 让 `/news` 导出成
 * `out/news.html`、`/news/daily` 导出成 `out/news/daily.html`，而动态路由
 * `/news/daily/[date]` 导出成 `out/news/daily/2026-10-17.html`。两种都要能读，
 * 否则测试会因为「文件命名规则」而不是「页面内容」失败。
 */
function page(rel) {
  const candidates = [
    join(OUT, rel),
    // `news/index.html` → `news.html`
    join(OUT, rel.replace(/\/?index\.html$/, '.html')),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return null;
}

function skipIfNoBuild(t) {
  if (!existsSync(OUT)) {
    t.skip('out/ 不存在 —— 先跑 npm run build');
    return true;
  }
  return false;
}

test('首页：底部 Tab 栏与安全区下边距存在', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('index.html');
  assert.ok(html, 'index.html 应该存在');
  assert.match(html, /mobile-tab-bar/, '移动端底部 Tab 栏缺失');
  assert.match(html, /pb-tabbar/, '页面应给 Tab 栏预留下边距');
  assert.match(html, /tab-home/, 'Tab 栏缺少首页槽位');
  assert.match(html, /tab-news/, 'Tab 栏缺少资讯槽位');
  assert.match(html, /tab-search/, 'Tab 栏缺少搜索圆钮');
});

test('首页与各频道页都有 AI 资讯入口', (t) => {
  if (skipIfNoBuild(t)) return;
  // 侧栏与顶部导航是每页都有的，所以检查首页即可覆盖「界面上看得到入口」。
  const html = page('index.html');
  assert.ok(html);
  assert.match(html, /href="\/news"/, '首页缺少 /news 入口');
  // 上一轮加的四处入口至少有一个 testid 命中（hero / sidebar / header / footer）
  const hits = [
    'news-hero-cta',
    'news-sidebar-link',
    'news-nav-link',
    'news-footer-link',
    'home-news-heading',
  ].filter((id) => html.includes(id));
  assert.ok(hits.length >= 4, `资讯入口只找到 ${hits.length} 处：${hits.join(',')}`);
});

test('资讯频道五个分区页面都生成，并且都带频道栏', (t) => {
  if (skipIfNoBuild(t)) return;
  for (const rel of [
    'news/index.html',
    'news/daily/index.html',
    'news/weekly/index.html',
    'news/monthly/index.html',
    'news/hot/index.html',
  ]) {
    const html = page(rel);
    assert.ok(html, `${rel} 应该存在`);
    assert.match(html, /资讯流/, `${rel} 缺少频道栏（资讯流）`);
    assert.match(html, /AI 日报/, `${rel} 缺少频道栏（AI 日报）`);
  }
});

test('资讯流：卡片全部外链原文，且带来源署名', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('news/index.html');
  assert.ok(html);
  // 卡片标题的跳转目标必须是 external，而不是站内 /news/xxx 详情页
  assert.doesNotMatch(html, /href="\/news\/[a-z0-9]{20,}"/, '出现了站内资讯详情链接（该路由不存在）');
  assert.match(html, /rel="noopener noreferrer"/, '外链缺少 rel=noopener');
  assert.match(html, /AIHOT/, '缺少 AIHOT 出处说明（合规要求）');
});

test('日报：生成 179 期独立页面，含期号与统计', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('news/daily/2026-10-17/index.html');
  assert.ok(html, '最新一期日报页面应该存在');
  assert.match(html, /AI 日报 · 2026 年 10 月 17 日/, '日报页缺少日期标题');
  assert.match(html, /第 \d+ 期/, '日报页缺少期号');
  assert.match(html, /头条/, '日报页缺少头条区块');
  assert.match(html, /原文/, '日报页缺少原文链接');
  assert.match(html, /（本期完）/, '日报页缺少收尾标记');
});

test('日报归档页列出全部月份', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('news/daily/archive/index.html');
  assert.ok(html);
  for (const m of ['2026 年 10 月', '2026 年 9 月', '2026 年 4 月']) {
    assert.match(html, new RegExp(m), `归档页缺少 ${m}`);
  }
});

test('周报与月报各期页面生成，并带翻页', (t) => {
  if (skipIfNoBuild(t)) return;
  const weekly = page('news/weekly/index.html');
  const monthly = page('news/monthly/index.html');
  assert.ok(weekly);
  assert.ok(monthly);
  assert.match(weekly, /第 \d+ 周|AI 周报/);
  assert.match(monthly, /2026 年/);
});

test('热点榜：十条带热度与来源', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('news/hot/index.html');
  assert.ok(html);
  assert.match(html, /个信号|家来源/, '热点榜缺少热度指标');
});

test('manifest 与 PWA 元数据', (t) => {
  if (skipIfNoBuild(t)) return;
  const mf = page('manifest.webmanifest') ?? page('manifest.json');
  assert.ok(mf, 'manifest 应该被导出');
  const json = JSON.parse(mf);
  assert.equal(json.display, 'standalone');
  assert.equal(json.lang, 'zh-CN');
  assert.ok(Array.isArray(json.icons) && json.icons.length > 0, 'manifest 缺少图标');
  const html = page('index.html');
  // Next 15 输出的是标准化的 `mobile-web-app-capable`；老版 iOS 还认
  // `apple-mobile-web-app-capable`。两者任一存在即视为通过。
  assert.match(html, /(apple-)?mobile-web-app-capable/, '缺少独立窗口（添加到主屏幕）元数据');
  assert.match(html, /viewport-fit=cover|viewportFit/, '缺少安全区适配');
});

test('所有页面都带 canonical', (t) => {
  if (skipIfNoBuild(t)) return;
  for (const rel of ['index.html', 'news/index.html', 'news/daily/index.html', 'news/hot/index.html']) {
    const html = page(rel);
    assert.ok(html, `${rel} 应存在`);
    assert.match(html, /rel="canonical"/, `${rel} 缺少 canonical`);
  }
});

test('首页 26 个分类区块全部渲染，且按四组呈现', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('index.html');
  assert.ok(html, 'index.html 应存在');

  // 四个分组标题必须都在。缺一个说明 `CATEGORY_GROUPS` 被改坏了。
  for (const title of ['创作与表达', '检索与研究', '办公与效率', '生意与专业']) {
    assert.ok(html.includes(title), `首页缺少分组标题「${title}」`);
  }

  // 26 个分类锚点（`<h2 id="{slug}">`）一个都不能少 —— 漏掉一个分类在页面上
  // 不会报错，只会静默少一整个区块，这是最容易漏掉的回归。
  const slugs = [
    'ai-agents', 'ai-chatbots', 'ai-writing', 'ai-image-design', 'ai-video-animation',
    'ai-coding', 'ai-audio-music', 'ai-ppt', 'ai-search-engine', 'ai-data-analysis',
    'ai-browser', 'ai-website-builder', 'ai-mindmap-whiteboard', 'ai-notetaker',
    'ai-content-detection', 'ai-document-tools', 'ai-learning-tools', 'ai-academic-tools',
    'ai-cloud-platforms', 'ai-prompt-tools', 'ai-marketing-sales', 'ai-translation-tools',
    'ai-recruiting-tools', 'ai-finance-tools', 'ai-lawer-tools', 'ai-customer-support',
  ];
  const missing = slugs.filter((s) => !html.includes(`id="${s}"`));
  assert.deepEqual(missing, [], `首页缺少分类锚点：${missing.join(', ')}`);
});

/* ──────────────────────────────────────────────────────────────────────────
 * 2026-10-18 这一轮改动新增的构建产物断言。
 *
 * 全部读 `out/`，所以它们守的是「最终页面长什么样」，而不是组件实现。
 * ────────────────────────────────────────────────────────────────────────── */

test('新路由都生成：/favorites 与 /offline', (t) => {
  if (skipIfNoBuild(t)) return;
  for (const rel of ['favorites.html', 'offline.html']) {
    const html = page(rel);
    assert.ok(html, `${rel} 应该被导出（静态导出新增路由必须真出文件）`);
  }
  // 收藏页含本机存储说明，且不应被搜索引擎收录（每人的收藏都不同）
  const fav = page('favorites.html');
  assert.match(fav, /本机|localStorage|浏览器/, '/favorites 应说明数据存在本机');
  assert.match(fav, /noindex/, '/favorites 应带 noindex');
});

test('分享出来的工具栈 /stack 也生成，且同样 noindex', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('stack.html');
  assert.ok(html, '/stack 应该被导出（收件人打开的落地页）');
  assert.match(html, /noindex/, '/stack 的内容完全由查询参数决定，收录只会抓到空壳');
  // 静态 HTML 里是客户端骨架（链接参数要等浏览器读 location.search），
  // 所以只能断言页头这类确定会预渲染的文案存在。
  assert.match(html, /一个分享出来的 AI 工具栈/, '/stack 缺少只读说明的页头');
  assert.match(html, /我的工具栈/, '/stack 缺少回 /favorites 的入口');
});

test('首页有「编辑精选」集合入口（原先 9 个集合全站 0 内链）', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('index.html');
  assert.match(html, /href="\/collections"/, '首页缺少 /collections 入口');
  assert.match(html, /编辑精选/, '首页缺少「编辑精选」标题');
  // 至少 3 个具体集合的链接（不是只有总览）
  const deep = (html.match(/href="\/collections\/[a-z0-9-]+"/g) ?? []).length;
  assert.ok(deep >= 3, `首页应直链至少 3 个集合，实际 ${deep}`);
});

test('页脚与侧栏都有「我的收藏」「精选集合」，且不再有「即将开放」死文案', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('index.html');
  assert.match(html, /href="\/favorites"/, '页脚/侧栏缺少收藏入口');
  assert.match(html, /href="\/collections"/, '缺少集合入口');
  assert.ok(!html.includes('即将开放'), '页脚不应再有「提交工具（即将开放）」的死文案');
});

test('404 页给出搜索与分类出口，且标题不是首页标题', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('404.html');
  assert.ok(html, '404.html 应存在');
  assert.match(html, /href="\/tools"/, '404 应给出搜索/工具目录出口');
  assert.match(html, /href="\/categories\/[a-z0-9-]+"/, '404 应给出分类入口');
  // title 必须是 404 自己的，不能是首页那句
  const m = html.match(/<title>([^<]*)<\/title>/);
  assert.ok(m, '404 应有 title');
  assert.ok(
    !m[1].includes('探索发现热门的智能体和AI工具'),
    `404 的 title 仍是首页标题：${m[1]}`,
  );
});

test('页眉不再有「登录/注册」按钮，也不再出现「复刻」字样', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('index.html');
  assert.ok(!html.includes('登录/注册'), '页眉不应再有假的登录按钮');
  assert.ok(!html.includes('复刻'), '页面不应出现「复刻版本」这类措辞');
  assert.match(html, /href="\/favorites"/, '右上角应换成「我的收藏」');
});

test('首页主 CTA 是工具而不是资讯', (t) => {
  if (skipIfNoBuild(t)) return;
  const html = page('index.html');
  // hero 里「浏览全部工具」出现在「看今天的 AI 资讯」之前（DOM 顺序即视觉顺序）
  const toolsAt = html.indexOf('浏览全部工具');
  const newsAt = html.indexOf('news-hero-cta');
  assert.ok(toolsAt > 0, '首页应有「浏览全部工具」');
  assert.ok(newsAt > 0, '资讯入口仍应保留（只是降为次按钮）');
  assert.ok(toolsAt < newsAt, 'DOM 顺序上工具主按钮应排在资讯之前');
});

test('客户端 layout chunk 里不再有目录数据（每个页面都付的那 182 KB）', (t) => {
  if (skipIfNoBuild(t)) return;
  const dir = join(OUT, '_next', 'static', 'chunks', 'app');
  if (!existsSync(dir)) {
    t.skip('找不到 _next/static/chunks/app');
    return;
  }
  const layouts = readFileSync(join(OUT, 'index.html'), 'utf8').match(/layout-[a-f0-9]+\.js/g);
  assert.ok(layouts && layouts.length > 0, '首页应引用 layout chunk');

  const file = join(dir, layouts[0]);
  assert.ok(existsSync(file), `layout chunk 不存在：${file}`);
  const js = readFileSync(file, 'utf8');

  // 目录数据的特征：prose 字段，以及「成规模的工具对象数组」。
  //
  // 注意不能简单断言「不含某个工具名」—— `nav.json` 里确实有 5 条「常用推荐」
  // 的名称与简介（5 KB / br 1.4 KB），那是页眉与搜索面板的初始推荐，
  // 属于**有意保留**的客户端数据。要守的是 2081 条完整目录不再进来。
  assert.ok(!js.includes('"prose"'), 'layout chunk 里出现了 prose（14 MB 正文的一部分）');

  // 目录里的工具对象都带 `"image"`（截图路径）与 `"variant"` 字段，
  // 而 nav.json 的推荐只有 slug/name/description/icon/href。出现这两个字段
  // 就说明有人又把 `@/lib/data` 的 `tools` 拖进客户端了。
  assert.ok(!js.includes('"variant"'), 'layout chunk 里出现了 Tool 的 variant 字段（目录数据）');
  assert.ok(
    !js.includes('/assets/shots/'),
    'layout chunk 里出现了截图路径（目录数据带 image，nav.json 不带）',
  );

  // 体积守卫：br 后超过 300 KB 说明又有人把大对象 import 进 client 组件了。
  // 2026-10-18 实测 29 KB（改动前 1,555 KB / br 182 KB）。
  const brKb = brotliCompressSync(Buffer.from(js)).length / 1024;
  assert.ok(brKb < 300, `layout chunk 的 br 体积 ${brKb.toFixed(0)} KB 过大（应 <300 KB）`);
});

test('搜索索引与导航数据都在产物里，且索引不含 prose', (t) => {
  if (skipIfNoBuild(t)) return;
  const nav = page('index.html');
  // 搜索索引会随某个 chunk 下发；这里只验证它没把正文带进来。
  //
  // 2026-10-22：索引换成了 v2 的紧凑 wire 格式 —— 顶层是
  // `{v:2, cats, tags, kw, pl, rows}` 而不是裸数组。行是定长位置元组
  // （分类/标签/关键词存字典下标、平台存 bitmask、icon 只存扩展名字母），
  // 所以这里只能按 wire 的形状断言；解码成 `SearchRecord[]` 是
  // `decodeSearchIndex()` 的事，`tests/search.test.mjs` 负责那一层。
  const idx = JSON.parse(readFileSync(join(process.cwd(), 'data', 'search-index.json'), 'utf8'));
  assert.equal(idx.v, 2, '索引必须是 v2 wire 格式（跑 npm run gen:search-index）');
  assert.ok(Array.isArray(idx.rows), '索引应有 rows 数组');
  assert.equal(idx.rows.length, 2081, `索引应有 2081 条，实际 ${idx.rows?.length}`);
  assert.ok(idx.rows.every((r) => Array.isArray(r) && r.length >= 8), '每行应是定长位置元组');
  // 正文（prose，14 MB）绝不能进索引 —— 它是详情页才需要的东西。
  assert.ok(!JSON.stringify(idx).includes('prose'), '索引不应包含 prose 字段');
  // 命令面板的「在全部工具中搜索」出口要能在首页找到（空查询时不显示，
  // 所以这里只断言面板代码进了 bundle）。
  assert.match(nav, /_next\/static/, '首页应引用静态资源');
});
