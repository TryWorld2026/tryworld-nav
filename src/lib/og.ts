import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

/**
 * Per-page Open Graph / Twitter card.
 *
 * ## 为什么需要这个 helper
 *
 * Next 的 metadata 是**按顶层键浅合并**的：页面自己定义了 `openGraph`，
 * 根 layout 的 `openGraph` 就被**整体替换**；页面没定义，就**整体继承**根的。
 * 两种结果都不对：
 *
 *   - 工具页自带 `openGraph` → 根的 `siteName` / `locale` / `url` 全丢，
 *     产物里**没有 `og:url`**；
 *   - 没自带 `openGraph` 的页面（分类、资讯、静态页）→ 继承根的，
 *     于是 `og:url` 是**首页**、`og:title` / `og:description` 是**全站文案**。
 *
 * 后者最要命：把一个分类页分享到微信，卡片显示的是站点首页的标题与描述。
 * 对一个导航站来说，分享就是获客路径，这条路径整个接错了。
 *
 * ## 契约
 *
 * - `url` 与 `canonical()` 用**同一套归一化**（首页带斜杠、其余不带），
 *   卡片链接与 canonical 永远指向同一个地址；
 * - `images` 一定有值：页面自带图就用自带图，没有就退回站点 og.png ——
 *   空 `images` 会让部分平台渲染成没有封面的纯文字条；
 * - `title` / `description` 取**这一页自己的**（`meta` 里已经写好的），
 *   不传站点默认值。
 */

/** `Metadata['title']` 有四种形态，这里都折成一条纯文本。 */
function plainTitle(title: Metadata['title']): string {
  if (!title) return SITE.title;
  if (typeof title === 'string') return title;
  if ('absolute' in title && title.absolute) return title.absolute;
  if ('default' in title && title.default) return title.default;
  return SITE.title;
}

/** `Metadata['description']` 实际只有字符串一种形态，但类型上允许 undefined。 */
function plainDescription(description: Metadata['description']): string {
  return typeof description === 'string' ? description : SITE.description;
}

/**
 * 给一份已经写好的 metadata 补上这一页自己的分享卡片。
 *
 * 用法：`export const metadata = withOg({ ...canonical('/x'), title, description }, '/x')`。
 * 路径传一次即可 —— `url` 与 canonical 保持一致，不用手抄两遍。
 *
 * `opts` 用来覆盖少数几个特殊页面：日报是 `type: 'article'` 且带发布时间，
 * 工具页/集合页有自己的封面图。
 */
export function withOg(
  meta: Metadata,
  path: string,
  opts?: {
    image?: string;
    ogType?: 'website' | 'article';
    publishedTime?: string;
  },
): Metadata {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
  const url = `${SITE.url}${normalized}`;
  const title = plainTitle(meta.title);
  const description = plainDescription(meta.description);
  const cover = opts?.image || SITE.ogImage;

  return {
    ...meta,
    openGraph: {
      type: opts?.ogType ?? 'website',
      title,
      description,
      url,
      siteName: SITE.name,
      locale: 'zh_CN',
      ...(opts?.publishedTime ? { publishedTime: opts.publishedTime } : {}),
      images: [{ url: cover, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [cover],
    },
  };
}
