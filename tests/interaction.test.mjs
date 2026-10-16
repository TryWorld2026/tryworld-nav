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
    const ok = await page.evaluate(() => {
      const el = document.querySelector("button[aria-label='Toggle mobile menu'], button[aria-label='Search']");
      if (!el) return false;
      return Object.keys(el).some((k) => k.startsWith('__react'));
    });
    if (ok) return true;
    await page.waitForTimeout(300);
  }
  return false;
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
      await page.locator("button[aria-label='Toggle mobile menu']").first().click();
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
      await page.locator("button[aria-label='Toggle mobile menu']").first().click();
      await page.waitForTimeout(800);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      assert.equal(await page.locator("button[aria-label='关闭菜单']").count(), 0, 'Esc 应关掉菜单');

      assert.deepEqual(errors, [], '移动端首页不应有 console 错误');
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
      await page.locator("button[aria-label='Toggle mobile menu']").first().click();
      await page.waitForTimeout(800);

      const link = page.locator("a[href='/categories']");
      assert.ok(await link.count() > 0, '菜单里应有 /categories 链接');
      await link.first().click();
      await page.waitForTimeout(2500);

      assert.ok(page.url().replace(/\/$/, '').endsWith('/categories'), `应导航到 /categories，实际 ${page.url()}`);
      assert.equal(
        await page.locator("button[aria-label='关闭菜单']").count(), 0,
        '导航后菜单应自动关闭（这是 pathname 变化时关闭抽屉的正确行为）',
      );
    } finally {
      await browser.close();
    }
  });

  test('首页无横向滚动', async (t) => {
    if (!ready(t)) return;
    const { browser, page } = await openPage({ width: 390, height: 844 }, true);
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await waitHydrated(page);
      await page.waitForTimeout(2000);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(overflow, false, '移动端不应出现横向滚动');
    } finally {
      await browser.close();
    }
  });
});

describe('404 页', () => {
  test('无 SVG 属性错误，返回首页按钮可用', async (t) => {
    if (!ready(t)) return;
    const { browser, page, errors } = await openPage({ width: 390, height: 844 }, true);
    try {
      const resp = await page.goto(BASE + '/no-such-page-xyz', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      assert.equal(resp.status(), 404, '应返回 404 状态码');
      const svgErrs = errors.filter((e) => /svg|Expected length/i.test(e));
      assert.deepEqual(svgErrs, [], '不应有 SVG 属性错误（height="auto" 那处）');

      const btn = page.locator("a:has(button:has-text('返回首页'))");
      assert.equal(await btn.count(), 1, '应有返回首页按钮');
      assert.ok(await btn.first().isVisible(), '按钮应可见');
      await btn.first().click();
      await page.waitForTimeout(2500);
      assert.ok(page.url().replace(/\/$/, '') === BASE.replace(/\/$/, ''), '点击应回到首页');
    } finally {
      await browser.close();
    }
  });
});

describe('桌面端交互', () => {
  test('所有分类面板能开能关，登录弹窗能开能关', async (t) => {
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

      await page.mouse.click(700, 500);
      await page.waitForTimeout(800);
      assert.equal(await cat.getAttribute('aria-expanded'), 'false', '点外部应关闭面板');

      const auth = page.locator("button:has-text('登录/注册')").first();
      if (await auth.isVisible()) {
        await auth.click();
        await page.waitForTimeout(900);
        assert.ok(await page.locator('[role=dialog]').count() > 0, '登录弹窗应打开');
        const ack = page.locator("button:has-text('知道了')");
        assert.ok(await ack.count() > 0, '弹窗应有「知道了」按钮');
        await ack.first().click();
        await page.waitForTimeout(700);
        assert.equal(await page.locator('[role=dialog]').count(), 0, '「知道了」应关闭弹窗');
      }

      assert.deepEqual(errors, [], '桌面端首页不应有 console 错误');
    } finally {
      await browser.close();
    }
  });
});
