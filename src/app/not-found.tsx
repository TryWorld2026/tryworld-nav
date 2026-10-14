import Link from 'next/link';
import { NotFoundArt } from '@/components/not-found-art';

/**
 * The origin's 404, verbatim from the SSR payload of a URL that misses — the
 * illustration, the `404 - 页面未找到` heading, and one 返回首页 button pointing
 * at the bare host. There is no second button on the origin; the replica
 * previously invented a 浏览全部工具 one, now removed.
 */
export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-230px)] flex flex-col items-center justify-center gap-4">
      <NotFoundArt />
      <h1 className="text-2xl font-medium font-display">404 - 页面未找到</h1>
      <Link href="/">
        <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
          返回首页
        </button>
      </Link>
    </div>
  );
}
