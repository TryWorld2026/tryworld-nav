import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { SiteSidebar } from '@/components/site-sidebar';
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
 */
export const viewport: Viewport = {
  themeColor: '#F2EEE6',
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
          <div className="flex-1 lg:ml-48 bg-background">
            <Header />

            {/* 三层结构：min-height 列、flex-grow 的 <main>、以及真正承载页面
                的 `flex-1` 子元素。`main` 套 `main` 是无效 HTML，但它正是让
                侧栏那条全高边线对齐的原因——内层 <main> 是唯一被拉伸的。 */}
            <main>
              <div className="min-h-screen flex flex-col">
                <main className="flex-grow flex">
                  <div className="flex-1">{children}</div>
                </main>
              </div>
            </main>

            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
