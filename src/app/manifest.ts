import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * PWA manifest —— 「添加到主屏幕」后以独立窗口打开，没有地址栏。
 *
 * 这是「做出 APP 的感觉」在浏览器之外的最后一公里：iOS Safari 与 Android
 * Chrome 都读这份文件。iOS 还需要 `apple-mobile-web-app-capable`
 * （见 `layout.tsx` 的 metadata），两套标准各管一摊。
 *
 * **可安装的硬条件**：Chrome 要在清单里同时找到一张 192×192 与一张 512×512
 * 的**位图**。`sizes: 'any'` 的 SVG 不算数（浏览器不肯把矢量当安装图标的
 * 尺寸证据），所以 `generate-sw` 与 `gen-pwa-icons.mjs` 生成的 192/512 PNG
 * 不是「多给几种尺寸」，而是判定能不能装的那两块拼图。此前只有一张 256
 * （实际 180）的 PNG，安装入口一直是灰的。
 *
 * `purpose: 'maskable'` 单独一条、不复用 512 那张：maskable 允许系统把图标
 * 裁成圆形 / 水滴形，内容必须落在中心 80% 的安全区内。把一张 content 铺满
 * 100% 的图同时标成 `any maskable`，是被主流启动器切成缺角的经典写法。
 * `icon-maskable-512.png` 是「缩到 80% + 四周铺骨白」的另做一张。
 *
 * 图标路径写绝对 `/assets/site/...`：`manifest.ts` 被导出到
 * `manifest.webmanifest`，它不是页面，`metadataBase` 不参与解析，相对路径会
 * 相对到清单文件所在目录。
 *
 * `display: 'standalone'` 而不是 `fullscreen`：全屏会藏掉状态栏，读者看不到
 * 时间与电量，这不是一个内容站该有的取舍。
 */
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} · 智能体与 AI 工具导航`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    // 离线兜底页是站内页面，scope 留根，SW 才能在任意导航上接住请求。
    scope: '/',
    display: 'standalone',
    background_color: '#F2EEE6',
    theme_color: '#F2EEE6',
    lang: 'zh-CN',
    dir: 'ltr',
    orientation: 'portrait',
    categories: ['productivity', 'utilities', 'news'],
    icons: [
      {
        src: '/assets/site/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      // apple-touch-icon 的实际尺寸是 180×180（读 sharp metadata 实测），
      // 不是这里原先写的 256。声明一个不存在的尺寸，Chrome 会拿图片实际
      // 像素去核对并判定不符 —— 这也是它不爱用的原因之一。
      {
        src: '/assets/site/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/site/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/site/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/site/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
