import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/data';

/**
 * PWA manifest —— 「添加到主屏幕」后以独立窗口打开，没有地址栏。
 *
 * 这是「做出 APP 的感觉」在浏览器之外的最后一公里：iOS Safari 与 Android
 * Chrome 都读这份文件。iOS 还需要 `apple-mobile-web-app-capable`
 * （见 `layout.tsx` 的 metadata），两套标准各管一摊。
 *
 * 图标沿用站点已有的 256×256 apple-touch-icon 与 SVG 主标。没有 512×512
 * 位图就不声明 `512` 尺寸 —— manifest 里写一个不存在的尺寸，Chrome 会判定
 * 安装条件不满足，反而装不上。
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
    display: 'standalone',
    background_color: '#F2EEE6',
    theme_color: '#F2EEE6',
    lang: 'zh-CN',
    orientation: 'portrait',
    categories: ['productivity', 'utilities', 'news'],
    icons: [
      {
        src: '/assets/site/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/assets/site/apple-touch-icon.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
