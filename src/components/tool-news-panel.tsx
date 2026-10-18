import Link from 'next/link';
import { ArrowUpRight, Newspaper } from 'lucide-react';
import { newsForTool } from '@/lib/news-links';
import { newsItems } from '@/lib/data';
import { formatDateShort } from '@/lib/news';

/**
 * 工具详情页右栏的「相关资讯」。
 *
 * 为什么需要：资讯与工具目录原先**零互链**（work/analysis-ia.md §7）——
 * 读资讯的人回不到工具页，找工具的人看不到站内有资讯。这个面板补上反方向：
 * 某个工具被资讯提到过，就在它的详情页列出来。
 *
 * 数据在构建期算（`newsForTool` 扫 124 条标题/摘要），没有匹配就整块不渲染 ——
 * 大多数长尾工具不会有资讯，空盒子比没有更糟。
 */
export function ToolNewsPanel({ slug, name }: { slug: string; name: string }) {
  const related = newsForTool(slug, newsItems, 3);
  if (related.length === 0) return null;

  return (
    <div className="rounded-lg border border-foreground/10 bg-card p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Newspaper className="h-4 w-4 text-gongke-accent" aria-hidden="true" />
        相关资讯
      </h2>
      <ul className="mt-2.5 space-y-2.5">
        {related.map((it) => (
          <li key={it.id}>
            <a
              href={it.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block text-[13px] leading-snug text-foreground/80 transition-colors hover:text-gongke-accent"
            >
              <span className="line-clamp-2">{it.title}</span>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {formatDateShort(it.publishedAt)} · {it.source}
                <ArrowUpRight
                  className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70"
                  aria-hidden="true"
                />
              </span>
            </a>
          </li>
        ))}
      </ul>
      {/* 搜索词必须是**工具名**，不是 slug。`searchNews` 是字面子串匹配：
          工具名「Kimi PPT助手」能命中标题，而 slug `kimi-ppt-zhushou`
          在任何标题里都不存在 —— 用 slug 搜会得到一个空结果页，
          明明上面刚列出三条相关资讯。 */}
      <Link
        href={`/news?q=${encodeURIComponent(name)}`}
        className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-gongke-accent hover:underline"
      >
        在资讯频道搜索
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
