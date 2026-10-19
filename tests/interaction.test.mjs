/**
 * 交互回归测试（需要本地服务器）。
 *
 * 覆盖 2026-10-16 对抗式审查发现的两个真实缺陷，它们**在桌面端都看不出来**，
 * 所以必须按视口分别断言：
 *
 *   1. **移动菜单打不开**。`mobile-nav.tsx` 里原本写
 *      `useEffect(() => onClose(), [pathname, onClose])` —— effect 在挂载后
 *      也会执行一次，于是菜单刚开就被关掉，DOM 里面板只存在一帧。桌面端不受
 *      影响（"所有分类"面板不走这个组件），所以只看桌面测试会漏掉。
 *   2. **404 插图报 SVG 属性错误**。原站写 `height="auto"`，而 SVG 的
 *      width/height 属性不接受 `auto`，浏览器控制台报
 *      `Expected length, "auto"`。
 *
 * 运行方式：
 *   node --test tests/interaction.test.mjs
 *
 * 需要先起本地服务器（默认 http://localhost:3100，可用 BASE_URL 覆盖）：
 *   npx serve out -l 3100
 *
 * 服务器不可达时整个套件会 **skip** 而不是 fail —— 这样它既能进 CI（那里没有
 * 起服务器），也能在本地部署前手动跑。
 */
import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * 页眉汉堡按钮的选择器：**新旧两套 aria-label 都认**。
 *
 * 2026-10-19 页眉改版把 `aria-label="Toggle mobile menu"` 换成了中文
 * `aria-label="打开导航菜单"`（对屏幕阅读器更友好）。测试里写死的英文标签
 * 于是全部命中不到，4 条移动端用例以 30s 超时失败 —— 报错是"找不到按钮"，
 * 看起来像"菜单坏了"，实际只是选择器过期。
 *
 * 用逗号并集同时接受两套：后续再改文案不会连带打挂交互回归；如果真把汉堡
 * 入口删了，两边都命中不到，测试仍然会红。
 */
const MENU_BUTTON =
  "button[aria-label='打开导航菜单'], button[aria-label='Toggle mobile menu']";

/** 命令面板的触发按钮，同理（`Search` → `搜索AI工具`）。 */
const SEARCH_BUTTON = "button[aria-label='搜索AI工具'], button[aria-label='Search']";

/** 「页面已水合」的判定锚点：页眉里任意一个可交互按钮（汉堡或搜索）。 */
const HYDRATION_ANCHOR = `${MENU_BUTTON}, ${SEARCH_BUTTON}`;

let chromium = null;
let serverUp = false;
let skipReason = null;

before(async () => {
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    chromium = null;
    skipReason = '未安装 playwright';
    return;
  }
  // 用 node:net 直接探 TCP 端口，而不是 fetch。
  //
  // 踩过的坑：`serve` 在 Windows 上只监听 IPv6 的 ::1，而 Node 的 fetch 解析
  // `localhost` 时可能先走 IPv4 的 127.0.0.1，于是连接被拒 —— 探测失败、整个
  // 套件静默跳过，而服务器其实是好的（curl 打得通，因为它会试 ::1）。
  // TCP 直连两种地址，任一通即算就绪。
  serverUp = await probePort(BASE);
  if (!serverUp) skipReason = `本地服务器不可达（${BASE}）—— 先跑 npx serve out -l 3100`;
});

/** 探测 BASE 的 TCP 端口，IPv4/IPv6 都试。 */
function probePort(url) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return resolve(false);
    }
    const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
    const hosts = u.hostname === 'localhost' ? ['127.0.0.1', '::1'] : [u.hostname];
    let pending = hosts.length;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      if (ok) { done = true; return resolve(true); }
      if (--pending === 0) { done = true; resolve(false); }
    };
    for (const host of hosts) {
      const sock = net.connect({ host, port });
      const timer = setTimeout(() => { sock.destroy(); finish(false); }, 3000);
      sock.once('connect', () => { clearTimeout(timer); sock.destroy(); finish(true); });
      sock.once('error', () => { clearTimeout(timer); sock.destroy(); finish(false); });
    }
  });
}

/**
 * 在**测试体内**决定跳过，而不是用 describe 的 skip 选项。
 *
 * 原因：`describe(name, { skip })` 的 skip 值在**套件定义时**就求值了，那时
 * `before` 还没运行 —— 于是 chromium/serverUp 都还是初始值，整套测试被静默
 * 跳过（实测 3 个 suite 全部 SKIP、0 个执行）。这里改成在每个 test 开头检查，
 * 用 `t.skip()` 在运行时跳过。
 */
function ready(t) {
  if (!chromium || !serverUp) {
    t.skip(skipReason ?? '环境未就绪');
    return false;
  }
  return true;
}

/**
 * 起浏览器。优先用系统已装的 Chrome/Edge（`channel`），避免为了跑测试再下载
 * 一份 Playwright 自带的 Chromium —— 那要多下约 150MB，而 CI 与本机通常都已经
 * 有浏览器了。都找不到时退回 Playwright 自带的（`npx playwright install` 装过就有）。
 */
async function launchBrowser() {
  const attempts = [{ channel: 'chrome' }, { channel: 'msedge' }, {}];
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch({ headless: true, ...opts });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * 等 React hydrate 完成再交互。
 *
 * 为什么需要：在 hydrate 之前点击，元素上**还没有 onClick**，点击自然没反应 ——
 * 会被误判成"按钮坏了"。2026-10-16 验证线上时就这么误报过一次：本地服务器
 * 毫秒级响应看不出问题，而线上首页 6MB、本机线路还丢包，hydration 要等几秒，
 * 当时 `hydrated: false` 就点了，菜单/面板双双"打不开"，等网络空闲后全部正常。
 *
 * 判据用 React 的内部属性：客户端组件挂载后，元素上会出现 `__react*` 键。
 */
async function waitHydrated(page, timeoutMs = 60_000) {
  try {
    await page.waitForLoadState('networkidle', { timeout: timeoutMs });
  } catch {
    /* 慢网络上 networkidle 可能等不到，继续用下面的轮询兜底 */
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return Object.keys(el).some((k) => k.startsWith('__react'));
    }, HYDRATION_ANCHOR);
    if (ok) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

/**
 * 把「媒体文件缺失导致的 404」从错误列表里滤掉。
 *
 * 为什么需要：`public/assets/{icons,shots,tags,news}`（约 4200 个文件 / 327 MB）
 * 被 gitignore，**CI 与任何干净检出都没有它们**。缺媒体时页面本身完全正常
 * （图片路径是烘焙进 HTML 的字符串，浏览器取不到就 404），但每条 404 都会往
 * 控制台写一条 "Failed to load resource: 404"。
 *
 * 2026-10-19 把交互测试接进 CI 时第一次暴露：本机有媒体 → 0 错误；干净检出
 * → 100+ 条 404，断言 `deepEqual(errors, [])` 直接红。这不是产品缺陷，
 * 是测试把「环境缺媒体」误判成了「页面有错」。
 *
 * 只滤 `Failed to load resource` 且状态 404 的那一类；JS 异常、React 水合
 * 错误、SVG 属性错误等仍然照常断言 —— 那些才是测试真正要守的东西。
 */
function realErrors(errors) {
  return errors.filter(
    (e) => !/Failed to load resource.*404|Failed to load resource.*Not Found/i.test(e),
  );
}

/** 起一个浏览器上下文，收集 console error / pageerror。 */
async function openPage(viewport, mobile) {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({
    viewport,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile ? MOBILE_UA : undefined,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  return { browser, ctx, page, errors };
}

describe('移动端交互', () => {
  test('汉堡菜单能打开、内容完整、能关闭', async (t) => {
    if (!ready(t)) return;
    const { browser, page, errors } = await openPage({ width: 390, height: 844 }, true);
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await waitHydrated(page);
      await page.waitForTimeout(2000);

      // 打开
      await page.locator(MENU_BUTTON).first().click();
      await page.waitForTimeout(1200);

      const panel = page.locator("button[aria-label='关闭菜单']");
      assert.equal(await panel.count(), 1, '菜单应出现（这正是那个 useEffect bug 的断言点）');
      assert.ok(await panel.first().isVisible(), '菜单面板应可见');

      // 内容完整：三个导航入口 + 热门分类
      assert.ok(await page.locator("a[href='/tools']").count() > 0, '应有「查看全部」');
      assert.ok(await page.locator("a[href='/about']").count() > 0, '应有「关于我们」');
      assert.ok(
        (await page.locator("a[href^='/categories/']").count()) >= 10,
        '应有热门分类链接',
      );

      // 关闭按钮
      await panel.first().click();
      await page.waitForTimeout(900);
      assert.equal(await page.locator("button[aria-label='关闭菜单']").count(), 0, '关闭按钮应关掉菜单');

      // Esc
      await page.locator(MENU_BUTTON).first().click();
      await page.waitForTimeout(800);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      assert.equal(await page.locator("button[aria-label='关闭菜单']").count(), 0, 'Esc 应关掉菜单');

      assert.deepEqual(realErrors(errors), [], '移动端首页不应有 console 错误');
    } finally {
      await browser.close();
    }
  });

  test('点菜单里的链接能导航且菜单自动关闭', async (t) => {
    if (!ready(t)) return;
    const { browser, page } = await openPage({ width: 390, height: 844 }, true);
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await waitHydrated(page);
      await page.waitForTimeout(2000);
      await page.locator(MENU_BUTTON).first().click();
      await page.waitForTimeout(800);

      // 限定在抽屉内：桌面侧栏在移动端是 `hidden lg:block`，而它现在也有
      // 一个 `a[href='/categories']`（「全部 26 个分类」出口）。直接
      // `.first()` 会取到那个不可见元素，点击会一直重试到超时。
      const drawer = page.locator("[role='dialog'][aria-label='站内导航']");
      const link = drawer.locator("a[href='/categories']");
      assert.ok(await link.count() > 0, '菜单里应有 /categories 链接');
      await link.first().click();

      /**
       * 等 URL 真的变成 /categories，而不是固定 sleep 2.5s。
       *
       * 为什么改：2026-10-18 起「所有分类」下拉底部也有 `/categories` 链接，
       * 而 `/categories` 页面本身的 HTML 有 444 KB（26 个分类卡 + 全部工具计数），
       * 客户端导航要在主线程解析完才 commit —— 本地 serve 上实测偶发超过 3s。
       * 固定等待会让这条断言变成「机器快慢的测试」而不是「行为是否正确的测试」。
       * `waitForURL` 有 15s 上限，真的导航不过去仍会红。
       */
      await page.waitForURL(/\/categories$/, { timeout: 15000 });
      await page.waitForTimeout(600);

      assert.ok(
        page.url().replace(/\/$/, '').endsWith('/categories'),
        `应导航到 /categories，实际 ${page.url()}`,
      );
      assert.equal(
        await page.locator("button[aria-label='关闭菜单']").count(), 0,
        '导航后菜单应自动关闭（这是 pathname 变化时关闭抽屉的正确行为）',
      );
    } finally {
      await browser.close();
    }
  });

  /**
   * 横向溢出回归（2026-10-17 实测到的真实缺陷）。
   *
   * 当时手机 390px 视口下 `/news/daily` 的 `scrollWidth` 是 765px —— 半页内容
   * 被推出屏幕。根因有三处，单独看每一处都不像 bug：
   *
   *   1. `layout.tsx` 的正文列是 flex 子项，默认 `min-width:auto`，取内容的
   *      最小固有宽度，于是被内层一条 `whitespace-nowrap` 长标题撑开；
   *   2. `news-tabs.tsx` 用 `-mx-4` 做贴边出血，父容器却没有 `overflow` 裁剪；
   *   3. 归档列表是 `grid` 但没写 `grid-cols-1`，列宽 `auto` 被最小内容撑到 680px。
   *
   * 单测首页是不够的（首页恰好没踩到），所以这里按**资讯频道全部页面**跑，
   * 且三档视口都跑 —— 桌面端 1440 当时也有 32px 溢出（`-mx-8`），只有手机
   * 的断言同样会漏。
   */
  test('资讯频道所有页面在 320/390/1440 下都无横向滚动', async (t) => {
    if (!ready(t)) return;
    const PAGES = [
      '/',
      '/news',
      '/news/daily',
      '/news/daily/2026-10-17',
      '/news/daily/archive',
      '/news/weekly',
      '/news/monthly',
      '/news/hot',
      '/tools',
      '/categories',
    ];
    const VIEWPORTS = [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ];

    for (const vp of VIEWPORTS) {
      const mobile = vp.width < 800;
      const { browser, page } = await openPage(vp, mobile);
      try {
        for (const path of PAGES) {
          await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(600);
          const { scrollW, clientW } = await page.evaluate(() => ({
            scrollW: document.documentElement.scrollWidth,
            clientW: document.documentElement.clientWidth,
          }));
          assert.ok(
            scrollW <= clientW + 1,
            `${vp.width}px 视口下 ${path} 横向溢出：${scrollW} > ${clientW}`,
          );
        }
      } finally {
        await browser.close();
      }
    }
  });

  /**
   * 跨天访问不得触发水合错误（2026-10-19 修复的线上缺陷）。
   *
   * 缺陷原样：`/news` 的分组标题用 `dayBucketLabel(key)`，默认参数是
   * `new Date()`。服务端预渲染在**构建那天**算出「今天 / 昨天 / 2 天前」并写进
   * HTML，客户端水合在**访问那天**再算一遍 —— 只要跨过北京时间午夜，两者就
   * 不同，React 报 #418（文本不匹配）并丢弃整棵服务端 DOM 重渲染。
   *
   * 为什么这条测试必须**拨时钟**：构建当天标签恰好一致，所以"部署后立刻复验
   * pageerror=0"永远测不出来 —— 这个 bug 就是这样藏到线上、并且每天更明显
   * （访问日比构建日晚 N 天，标签整体错 N 天）。把浏览器时钟往后拨 26 小时，
   * 模拟"部署后第二天"，才能稳定复现。
   *
   * 断言两条：① 不该有 #418；② 分组标签必须跟着**访问时刻**走（拨到 +26h 后
   * 仍显示「今天 / 昨天」这种相对说法，而不是构建那天的旧标签）。
   */
  test('跨天访问 /news 不触发水合错误（时钟 +26h）', async (t) => {
    if (!ready(t)) return;
    const { browser, page, errors } = await openPage({ width: 1440, height: 900 }, false);
    try {
      // Playwright 的时钟控制在页面脚本执行前生效。
      const target = new Date(Date.now() + 26 * 60 * 60 * 1000);
      await page.clock.install({ time: target });

      await page.goto(BASE + '/news', { waitUntil: 'domcontentloaded' });
      // 水合需要时间；固定等一段，避免 networkidle 在慢机器上永久挂住。
      await page.waitForTimeout(4000);

      const hydrationErrors = errors.filter(
        (e) => /#418|#423|hydrat|did not match|Text content does not match/i.test(e),
      );
      assert.deepEqual(
        hydrationErrors,
        [],
        `跨天访问不应有水合错误，实际：${hydrationErrors.join(' | ')}`,
      );

      // 分组标题必须在拨过的时钟下给出相对说法，且第一条不可能是「今天」
      // 之前构建日的数据 —— 这里只断言标签形态，避免依赖具体抓取日期。
      const labels = await page.$$eval('section h2', (els) =>
        els.map((e) => e.textContent.trim()).filter(Boolean).slice(0, 3),
      );
      assert.ok(labels.length > 0, '应至少有一个日期分组标题');
      assert.ok(
        labels.every((l) => /今天|昨天|天前|更早|时间未知/.test(l)),
        `分组标题应是相对标签，实际：${labels.join(' / ')}`,
      );
    } finally {
      await browser.close();
    }
  });
});

describe('404 页', () => {
  test('无 SVG 属性错误，给出搜索与分类出口，返回首页链接可用', async (t) => {
    if (!ready(t)) return;
    const { browser, page, errors } = await openPage({ width: 390, height: 844 }, true);
    try {
      const resp = await page.goto(BASE + '/no-such-page-xyz', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      assert.equal(resp.status(), 404, '应返回 404 状态码');
      const svgErrs = errors.filter((e) => /svg|Expected length/i.test(e));
      assert.deepEqual(svgErrs, [], '不应有 SVG 属性错误（height="auto" 那处）');

      // 2026-10-18 重做后：404 从「只有一个返回首页」变成三条出路。
      //
      // 注意选择器要限定在 404 的正文容器里：`a[href='/tools']` 在整页里有
      // 三个（页眉「查看全部」、移动底栏「工具」、404 正文主按钮），
      // 而移动端的页眉导航是 `hidden lg:flex` —— 直接 `.first()` 会命中一个
      // 不可见元素，断言就变成「页眉在不在」而不是「404 有没有给出路」。
      const main = page.locator('main').first();
      const toolsLink = main.locator("a[href='/tools']").first();
      assert.ok(await toolsLink.isVisible(), '404 应给出「搜索全部工具」出口');

      const catLinks = await main.locator("a[href^='/categories/']").count();
      assert.ok(catLinks >= 3, `404 应给出分类入口，实际 ${catLinks} 个`);

      const home = main.locator("a[href='/']").first();
      assert.ok(await home.isVisible(), '应有返回首页链接');
      await home.click();
      await page.waitForTimeout(2500);
      assert.ok(page.url().replace(/\/$/, '') === BASE.replace(/\/$/, ''), '点击应回到首页');
    } finally {
      await browser.close();
    }
  });
});

describe('桌面端交互', () => {
  test('所有分类面板能开能关，下拉底部有分类总览/精选集合出口', async (t) => {
    if (!ready(t)) return;
    const { browser, page, errors } = await openPage({ width: 1440, height: 900 }, false);
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await waitHydrated(page);
      await page.waitForTimeout(2000);

      const cat = page.locator("button:has-text('所有分类')").first();
      await cat.click();
      await page.waitForTimeout(1000);
      assert.equal(await cat.getAttribute('aria-expanded'), 'true', '分类面板应展开');
      assert.ok(
        (await page.locator("a[href^='/categories/']").count()) >= 26,
        '分类面板应含全部 26 个分类',
      );
      // 2026-10-18：下拉里补了三个出口，原先只有 26 个分类、没有去总览的路。
      assert.ok(
        await page.locator("a[href='/categories']").first().isVisible(),
        '下拉底部应有「分类总览」',
      );
      assert.ok(
        await page.locator("a[href='/collections']").first().isVisible(),
        '下拉底部应有「精选集合」',
      );

      await page.mouse.click(700, 500);
      await page.waitForTimeout(800);
      assert.equal(await cat.getAttribute('aria-expanded'), 'false', '点外部应关闭面板');

      assert.deepEqual(realErrors(errors), [], '桌面端首页不应有 console 错误');
    } finally {
      await browser.close();
    }
  });

  /**
   * 换掉假登录之后新增的断言：右上角应该是真的「我的收藏」，点进去是真实页面。
   *
   * 原先这里测的是「登录/注册」弹窗能开能关 —— 那个弹窗的正文写着
   * 「复刻版本未包含账号系统，登录与注册暂不可用」，是首访最伤信任的一处。
   * 现在按钮直接链到 /favorites，所以断言也换成「链接存在且能到达」。
   */
  test('右上角是「我的收藏」，可到达 /favorites 并看到空态', async (t) => {
    if (!ready(t)) return;
    const { browser, page, errors } = await openPage({ width: 1440, height: 900 }, false);
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await waitHydrated(page);
      await page.waitForTimeout(1500);

      const favLink = page.locator("a[href='/favorites']").first();
      assert.ok(await favLink.isVisible(), '页眉应有「我的收藏」入口');
      // 全站不应再出现「复刻」两个字（那是上一版弹窗的措辞）。
      const body = await page.evaluate(() => document.body.innerText);
      assert.ok(!body.includes('复刻'), '页面上不应出现「复刻版本」这类措辞');

      await favLink.click();
      await page.waitForTimeout(1500);
      assert.ok(page.url().includes('/favorites'), '应导航到 /favorites');
      assert.ok(
        (await page.locator('body').innerText()).includes('还没有收藏'),
        '没有收藏时应显示空态',
      );
      assert.deepEqual(realErrors(errors), [], '/favorites 不应有 console 错误');
    } finally {
      await browser.close();
    }
  });

  /**
   * 筛选状态进 URL + 返回恢复 —— 这轮修的最重的体验问题。
   *
   * 原实现只在挂载时读一次 URL，用户操作不写回；筛到 297 条后点进详情再
   * 按返回，计数会变回 2081、输入框清空。这里断言三件事：
   *   1. 输入关键词后地址栏带上 ?q=；
   *   2. 点分类 chip 后地址栏带上 ?cat=；
   *   3. 刷新页面后筛选态还在（这是「可分享」的最直接证明）。
   */
  test('筛选写进 URL：输入与分类都更新地址栏，刷新后仍生效', async (t) => {
    if (!ready(t)) return;
    const { browser, page, errors } = await openPage({ width: 1440, height: 900 }, false);
    try {
      await page.goto(BASE + '/tools', { waitUntil: 'domcontentloaded' });
      await waitHydrated(page);
      await page.waitForTimeout(1500);

      const input = page.locator("input[placeholder*='搜索工具名称']");
      await input.fill('视频');
      await page.waitForTimeout(700); // 250ms 防抖 + 余量

      assert.match(page.url(), /[?&]q=/, `输入后地址栏应带 q，实际：${page.url()}`);

      const chip = page.locator("button[aria-pressed]:has-text('AI视频/动画')").first();
      await chip.click();
      await page.waitForTimeout(500);
      assert.match(page.url(), /[?&]cat=ai-video-animation/, `点分类后应带 cat，实际：${page.url()}`);

      // 刷新后状态从 URL 还原
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitHydrated(page);
      await page.waitForTimeout(1500);
      assert.equal(await input.inputValue(), '视频', '刷新后输入框应回填');
      assert.equal(
        await chip.getAttribute('aria-pressed'),
        'true',
        '刷新后分类 chip 应保持选中',
      );

      assert.deepEqual(realErrors(errors), [], '筛选过程不应有 console 错误');
    } finally {
      await browser.close();
    }
  });

});
