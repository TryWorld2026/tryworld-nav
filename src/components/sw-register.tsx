'use client';

import { useEffect } from 'react';

/**
 * 注册 Service Worker —— 「可安装」与「断网有兜底页」的最后一步接线。
 *
 * 为什么只在 https 下注册：Service Worker 的 API 本身就是 secure context
 * 限定（`http://localhost` 例外）。不做这个判断的话，本地用 IP 访问
 * （`http://192.168.x.x:3000`，手机上测响应式时最常用）会在控制台抛一个
 * `InvalidStateError`，而更麻烦的是真注册上以后，缓存会让后续的代码改动
 * 「改了但页面没变」——开发环境被 SW 污染一次要清半天。线上是 https，
 * 判断等于「只在线上生效」。
 *
 * 为什么在 `window.load` 之后注册，而不是 useEffect 直接调：导航首屏的
 * 字体、图片、RSC payload 都在抢带宽，SW 脚本下载与 install（要拉一次离线页）
 * 会跟它们抢。等 load 之后再注册，读者感知不到任何延迟，而「下一次访问才
 * 离线可用」对一次性访客也足够。
 *
 * 为什么挂在 body 末尾而不是 head：它不产出任何 DOM（`return null`），
 * 位置只影响脚本执行时机，放在末尾可以让首屏 HTML 解析不被它打断。
 *
 * 不做的事：没有 updatefound 提示条、没有「发现新版本，点击刷新」。站点是
 * 静态导出、每次部署换一批 chunk 名，SW 的导航策略又是 network-first，
 * 读者下一次导航拿到的就是新 HTML；弹一条「有新版本」只会是噪音。
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // 线上走 https；localhost 也算 secure context，但开发环境不需要 SW
    // （`npm run dev` 下没有 out/，`/sw.js` 会 404）。
    if (window.location.protocol !== 'https:') return;

    const register = () => {
      // `catch` 不是可选的：注册失败（CSP、被拦截的 SW 脚本、`/sw.js` 没被
      // 复制进 out/）会 reject，未处理的 rejection 在控制台里是红色的，容易被
      // 当成严重错误。SW 是纯增强，失败不该影响任何页面功能。
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        console.warn('[pwa] Service Worker 注册失败（不影响页面功能）', err);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register, { once: true });
    // 组件卸载（App Router 在 `template.tsx` 重挂载时不会走到这里，但
    // StrictMode 的双调用会）时解绑，避免同一个 load 上挂两次 register。
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
