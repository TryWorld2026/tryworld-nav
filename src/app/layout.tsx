import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { SiteSidebar } from '@/components/site-sidebar';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { SITE } from '@/lib/data';

export const metadata: Metadata = {
  // Absolute URLs need a base, or openGraph/twitter images resolve against
  // localhost and the preview cards break in production.
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: `%s - ${SITE.name}`,
  },
  description: SITE.description,
  keywords: SITE.keywords,
  authors: [{ name: SITE.name }],
  applicationName: SITE.name,
  // iOS「添加到主屏幕」以独立窗口打开所必需的元数据，与 `manifest.ts` 的
  // Android 路径互补（两套标准各读各的）。
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: 'default',
  },
  // 手机号在正文里出现时不自动变成拨号链接（工具介绍里常有版本号/数字）。
  formatDetection: { telephone: false },
  // The origin declares four icon flavours; the .ico and the apple-touch icon
  // are the two legacy clients still look for.
  icons: {
    icon: [
      { url: '/assets/site/icon.svg', type: 'image/svg+xml' },
      { url: '/assets/site/favicon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: { url: '/assets/site/favicon.ico', type: 'image/x-icon' },
    apple: {
      url: '/assets/site/apple-touch-icon.png',
      sizes: '256x256',
      type: 'image/png',
    },
  },
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    type: 'website',
    locale: 'zh_CN',
    url: SITE.url,
    siteName: SITE.name,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.title,
    description: SITE.description,
    images: [SITE.ogImage],
  },
};

/**
 * 单主题站点：试界品牌只验收了明亮骨白底，规范写明「该版本没有定义通用深色
 * 模式，不用简单反转颜色冒充已验收主题」。所以这里没有 ThemeProvider，也没有
 * `prefers-color-scheme` 分支——`themeColor` 就是骨白底本身。
 *
 * `viewportFit: 'cover'` 让页面延伸到 iPhone 的刘海与 Home 指示条区域，
 * 底部 Tab 栏再用 `env(safe-area-inset-bottom)` 把内容顶回来。没有它，
 * `env()` 恒为 0，Tab 栏会在有刘海的机型上悬空一截。
 *
 * `appleWebApp` 是 iOS「添加到主屏幕」以独立窗口打开所必需的元数据，与
 * `manifest.ts` 的 Android 路径互补（两套标准各读各的）。
 */
export const viewport: Viewport = {
  themeColor: '#F2EEE6',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      {/* body 只挂 `bg-background`，`min-h-screen` / `font-sans` /
          `text-foreground` 都来自 globals.css 的 body 规则。 */}
      <body className="bg-background">
        <div className="flex">
          <SiteSidebar />
          {/* `min-w-0` 是关键：flex 子项默认 `min-width:auto`，取内容的最小
              固有宽度。侧栏是 fixed 不参与布局，正文列就成了唯一子项；只要
              页面里有一条 `whitespace-nowrap` 的长标题或一个 `-mx-4` 的满宽
              元素，整列就会被撑到内容宽度（实测 390px 视口被撑到 765px，
              手机上一半页面被推出屏幕）。加上它以后，子项才可以真正收缩。 */}
          <div className="min-w-0 flex-1 lg:ml-48 bg-background pb-tabbar">
            <Header />

            {/* 三层结构：min-height 列、flex-grow 的 <main>、以及真正承载页面
                的 `flex-1` 子元素。`main` 套 `main` 是无效 HTML，但它正是让
                侧栏那条全高边线对齐的原因——内层 <main> 是唯一被拉伸的。 */}
            {/* `min-w-0` 逐层传递：`main` 与 `flex-1` 都曾是默认 `auto`，
                `min-w-0` 只加在最外层时下一层仍会被内容撑宽。 */}
            <main className="min-w-0">
              <div className="min-h-screen flex flex-col">
                <main className="min-w-0 flex-grow flex">
                  <div className="min-w-0 flex-1">{children}</div>
                </main>
              </div>
            </main>

            <SiteFooter />
          </div>
        </div>

        {/* 移动端底部 Tab 栏。`lg:hidden` 在组件内部，桌面端不占位。
            挂在 flex 容器外，避免参与侧栏与正文的两栏布局。 */}
        <MobileTabBar />

        {/* 让「添加到主屏幕」的启动画面与浏览器 chrome 同色。Next 会把
            `viewport.themeColor` 写进 <meta>，这里再给 iOS 的状态栏留一个
            与骨白底一致的背景（iOS 只认 `black-translucent` 或默认）。 */}
      </body>
    </html>
  );
}
