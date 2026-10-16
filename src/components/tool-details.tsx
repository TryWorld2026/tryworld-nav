/**
 * The 产品介绍 body — the origin's own HTML, verbatim.
 *
 * The prose is harvested from the origin's tool pages and is several MB across
 * the catalog, so it is emitted as one string and injected here rather than
 * re-expressed as React elements: the origin authored it in Feishu/Lark and
 * exported HTML, and the markup carries the artefacts of that pipeline
 * (`data-lark-html-role`, `data-docx-has-block-data`, `data-page-id`,
 * `style="width: 59.0426%"` on table cells, `<div>` wrappers inside `<li>`).
 * Re-deriving it would lose structure for no gain.
 *
 * It is injected with `dangerouslySetInnerHTML`, which is only defensible
 * because the harvest pass refuses to keep any slug whose prose contains a
 * script/style/iframe/object/embed/form element, an `on*` attribute, or a
 * `javascript:` URL. That check ran over all 2081 slugs and rejected none, and
 * every one of the 62 `href` values in the corpus is `https` or relative. The
 * alarming-looking attribute names in the corpus (`DATABASE_URL`,
 * `S3_UPLOAD_SECRET`, `HELICONE_API_KEY`) are text inside `<pre><code>`
 * examples, not attributes.
 *
 * If the corpus is ever re-harvested, re-run that check before trusting this
 * component — the sanitization is a property of the data, not of this file.
 *
 * Server component on purpose: no interactivity, so nothing here may reach the
 * client bundle.
 */

/**
 * The origin's own wrapper chain, verbatim:
 *
 *   <div class="mb-6"><div class="relative"><div class="prose prose-stone …" />
 *
 * The `mb-6` / `relative` levels carry no rules of their own — they are the
 * origin's own divs and are kept so the box metrics match. `prose` is the
 * @tailwindcss/typography ruleset, which the origin's bundle ships and this
 * project does not install; it is hand-rolled in `@layer components` in
 * globals.css instead, so the class names stay as they are.
 */
export function ToolProse({ prose }: { prose: string }) {
  return (
    <div className="mb-6">
      <div className="relative">
        <div
          className="prose prose-stone max-w-none px-4 text-foreground/80 prose-headings:mt-4 prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground prose-a:text-gongke-accent hover:prose-a:text-gongke-accent/80 prose-code:bg-gongke-gray/20 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 before:prose-code:content-[''] after:prose-code:content-[''] tool-details"
          dangerouslySetInnerHTML={{ __html: stripDeadNewsLinks(prose) }}
        />
      </div>
    </div>
  );
}

/**
 * 把指向**已不存在的站内新闻页**的链接降级成纯文本。
 *
 * 为什么需要：prose 是原站抓来的原文，里面有些链接指向 `/news/{slug}` 详情页。
 * 那个路由在 2026-10-15 随 `/news` 改版（改成 AIHOT 资讯卡片流）一起删掉了，
 * 所以这些链接现在**线上是 404**。实测整个语料里只有一处：
 * `/tools/bing-image-creator` 的「更加详细的指南，请查看：如何使用Bing创建图像」。
 *
 * 为什么不直接改数据：`data/tool-extras.json` 是抓取产物，重新抓取会覆盖手改。
 * 改数据等于埋一个"下次抓取就丢失"的补丁。渲染层处理才是持久的。
 *
 * 为什么是降级成纯文本而不是改指别处：原站那篇长文已随改版下线，没有等价的
 * 站内目标可指；指向 AIHOT 首页又不是读者点这个链接时想要的东西。保留文字、
 * 去掉链接，读者不会撞上 404，也不会有错误的跳转。
 *
 * 只匹配**站内** `/news/` 开头的 href；外链与其它站内路由一律不动。
 */
function stripDeadNewsLinks(html: string): string {
  return html.replace(
    /<a\b([^>]*?)href="\/news\/[^"]*"([^>]*?)>([\s\S]*?)<\/a>/gi,
    (_m, _pre, _post, inner) => inner,
  );
}
