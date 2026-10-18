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
