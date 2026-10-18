/*
 * 试界导航 Service Worker。
 *
 * 由 scripts/generate-sw.mjs 生成 —— 不要直接编辑这个文件，改脚本再重跑。
 * 版本：558d1687
 */
'use strict';

const VERSION = '558d1687';
const PREFIX = 'tw-';
const CACHE = PREFIX + VERSION;

/** 离线兜底页。线上路径是 /offline（导出后是 out/offline.html）。 */
const OFFLINE_URL = '/offline';

/**
 * 可以 cache-first 的路径：内容哈希命名或按内容切片，URL 变了内容才会变。
 *
 *   /_next/static/  —— Next 的 chunk / CSS / 字体，文件名里带内容哈希
 *   /fonts/         —— Noto Sans SC 的 unicode-range 切片，静态不变
 *   /assets/thumbs/ —— 缩略图（scripts/gen-thumbs.mjs 生成），按 slug 命名
 *
 * 其余一律不拦截：工具图标与截图（/assets/icons|shots）是 4000+ 张，逐个
 * 缓存会吃掉几十上百 MB 的配额，而离线时看它们本来也没意义。
 */
const IMMUTABLE = /^\/(?:_next\/static\/|fonts\/|assets\/thumbs\/)/;

/**
 * 预缓存时依次尝试的路径。
 *
 * '/offline' 是 Workers Static Assets 对外暴露的形态（默认 html_handling 会把
 * '/offline' 映射到 offline.html）。但 'npx serve out'、GitHub Pages 这类静态
 * 托管未必做这层映射，本地 'npm run preview' 就会 404。两个都试一次，谁先
 * 成功就用谁，并且统一存到 OFFLINE_URL 这个键下 —— 这样回退时是确定命中的，
 * 不会因为宿主形态不同而漏掉。
 */
const PRECACHE_CANDIDATES = [OFFLINE_URL, OFFLINE_URL + '.html'];

/**
 * 把站内路径补成绝对 URL。
 *
 * 为什么不用相对的：Request 构造器只接受绝对 URL，传 '/offline' 会抛
 * TypeError；fetch('/offline') 能工作是因为它按 SW 的 script URL 解析，但那
 * 依赖运行环境的解析规则。缓存键同理 —— caches.match 与 cache.put 各按自己
 * 那套解析，只要一处形态不同，就会出现「存进去了但取不到」。全部补成绝对
 * URL，存与取用同一个键，没有歧义。
 */
const abs = (path) => new URL(path, self.location.origin).href;

/**
 * 最后一道兜底：连预缓存都没成功时（首次安装撞上拦截式门户 / 中途断网），
 * 至少给一段能读的中文，而不是浏览器的恐龙页。
 *
 * 内联样式而不是引用 CSS：这份 HTML 要在「任何资源都可能取不到」的时刻渲染。
 */
const FALLBACK_HTML =
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>当前处于离线状态</title></head>' +
  '<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;' +
  'background:#F2EEE6;color:#1B2523;font:16px/1.7 -apple-system,BlinkMacSystemFont,sans-serif">' +
  '<main style="padding:24px;max-width:32rem">' +
  '<h1 style="font-size:24px;font-weight:650;margin:0 0 12px">当前处于离线状态</h1>' +
  '<p style="color:#616A63;margin:0 0 20px">网络连接已断开，页面暂时无法加载。恢复网络后刷新即可。</p>' +
  '<a href="/" style="display:inline-block;border-radius:9999px;background:#24564E;color:#F2EEE6;' +
  'padding:10px 18px;text-decoration:none">返回首页</a>' +
  '</main></body></html>';

/* ---------------------------------------------------------------- install */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // 逐个取而不是 cache.addAll：addAll 里任何一个失败会让整个 install
      // reject —— SW 装不上，连 _next/static 的 cache-first 都没了，而浏览器
      // 要等下一次导航才重试。离线页下载失败不该有这种连带伤害。
      let offline = null;
      for (const candidate of PRECACHE_CANDIDATES) {
        if (offline) break;
        try {
          const response = await fetch(abs(candidate), { cache: 'reload' });
          // 只认 200。这里不判 3xx：fetch 默认 redirect: 'follow'，SW 里拿到的
          // 已经是终点响应。而终点若是 200，它就是我们想缓存的那张页面
          // （Static Assets 把 /offline 映射到 offline.html 时正是这么做的）；
          // 终点若不是 200，下面这道判断会把它挡掉。
          if (response.ok && response.status === 200) offline = response;
        } catch (err) {
          // 换下一个候选；两个都失败才走 FALLBACK_HTML。
        }
      }

      if (offline) {
        // 统一存到绝对形式的 OFFLINE_URL 下，回退时用同一个 abs() 取。
        await cache.put(abs(OFFLINE_URL), offline);
      } else {
        console.warn('[sw] 离线页预缓存失败，回退时将使用内联兜底页');
      }

      // 新版立刻接管：导航是 network-first，不存在「拿旧内容」的风险，
      // 所以不需要「关闭所有标签页才更新」那套提示。
      await self.skipWaiting();
    })(),
  );
});

/* --------------------------------------------------------------- activate */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // 只清 PREFIX 开头且不是当前版本的缓存。不认识的缓存名一律不动：同域
      // 可能还有别的 SW（预览环境、旧实验）的缓存，误删别人的是纯伤害。
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );

      // 让本次激活立刻作用于已经打开的页面，不用等下一次导航。
      await self.clients.claim();
    })(),
  );
});

/* ------------------------------------------------------------------ fetch */

/**
 * 导航请求：网络优先。
 *
 * 为什么不是 cache-first：这是内容站，首页与列表页每天都在变，页面 HTML 又
 * 写死了 buildId 与 chunk 清单，缓存旧 HTML 会让部署后的第一次访问直接白屏。
 * 所以只要网络能通就走网络；只有**连不上**（断网、DNS 挂了、机房抽风）才回退
 * 到离线页。HTTP 4xx/5xx 不回退 —— 那是服务器的正常回答，拿离线页顶替会把
 * 一个「这个页面不存在」掩盖成「你断网了」。
 */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (err) {
    // 忽略查询串：离线页不需要区分 ?utm_* 这类参数。
    const cached = await caches.match(abs(OFFLINE_URL), { ignoreSearch: true });
    if (cached) return cached;
    return new Response(FALLBACK_HTML, {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * 不变量资源：cache-first。
 * 命中就直接返回（不发请求）；未命中才取网络，并把干净的 200 写回缓存。
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // 只缓存干净的 200。不额外要求 response.type === 'basic'：opaque 响应的
    // status 恒为 0、206（Range）不是 200，这两类已被这道判断挡住；再加一个
    // type 条件只会把同样可缓存的正常响应一并排除，换来「少缓存」。
    if (response.ok && response.status === 200) {
      const cache = await caches.open(CACHE);
      // put 是异步的，不该拖慢响应；失败（配额满）也只是少缓存一份。
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // 离线且未命中：给一个空 504 而不是让 promise reject，前者在控制台里是
    // 一条「资源加载失败」，后者是一串 unhandled rejection。
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 只处理同源 GET。外链（资讯原文、工具官网）由浏览器自己走，SW 一旦介入
  // 外域请求就要处理 opaque 响应与 CORS，收益为零、出错面很大。
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }

  // 其余请求不挂 respondWith：浏览器按默认行为处理，SW 不参与。
});
