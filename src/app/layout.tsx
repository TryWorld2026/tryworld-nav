import type { Metadata, Viewport } from 'next';
// 字体声明（101 条 @font-face）作为源码 CSS 引入，而不是留在 public/fonts/
// 让 globals.css 用 `@import url(...)` 去引。原因只有一个字：串行。
// CSS 的 @import 必须等引用它的那份样式表解析到那一行才发出请求，于是
// globals.css(74 KB) → fonts.css(106 KB) → woff2 是三级瀑布，字体比首屏
// 文字晚两个 RTT 才到。写成 import 之后两份 CSS 由 webpack 合成同一个产物、
// 同一个 <link>，字体请求与 CSS 同时发出。（用户看到的是 font-display: swap
// 造成的回退字形闪一下，闪完才换成 Noto Sans SC，观感上像「字突然变了」。）
import './globals.css';
import './fonts.css';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { SiteSidebar } from '@/components/site-sidebar';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { SwRegister } from '@/components/sw-register';
import { SITE } from '@/lib/site';

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
        {/* 跳转到主内容的链接。全站页眉有 4 个导航项 + 搜索 + 收藏，侧栏还有
            18 个分类 —— 键盘用户每次换页都要 Tab 几十次才能到正文
            （a11y 审计里 `landmarks.skipLink: false`）。这个链接平时视觉隐藏，
            聚焦时才出现，是 WCAG 2.4.1 的最小实现。 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:h-10 focus:items-center focus:rounded-md focus:bg-gongke-dark focus:px-4 focus:text-sm focus:font-medium focus:text-[#F2EEE6] focus:shadow-lg"
        >
          跳到主要内容
        </a>
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
                <main id="main-content" className="min-w-0 flex-grow flex">
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

        {/* Service Worker 注册 —— 「添加到主屏幕」与断网兜底页的接线。
            组件本身 `return null`，不产出任何 DOM，挂在这里只是让它进客户端
            bundle；实际注册发生在 `window.load` 之后，且只在 https 下执行，
            本地开发不受影响（见 components/sw-register.tsx）。 */}
        <SwRegister />

        {/* 让「添加到主屏幕」的启动画面与浏览器 chrome 同色。Next 会把
            `viewport.themeColor` 写进 <meta>，这里再给 iOS 的状态栏留一个
            与骨白底一致的背景（iOS 只认 `black-translucent` 或默认）。 */}
      </body>
    </html>
  );
}
