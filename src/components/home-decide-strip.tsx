import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { VERDICT_COUNT } from '@/lib/verdict-index';

/**
 * 首页 hero 之下、热门工具之上的「决策条」。
 *
 * 为什么首页需要这一条：这个站的主视觉一直在说「我们有 2081 个工具」，而读者
 * 真正的问题是「我该用哪个」。首页的两个 CTA 都是**浏览**方向（全部工具 /
 * AI 资讯），`/decide` 只有导航里一个入口 —— 一个能把用户从「翻目录」转成
 * 「做决定」的入口，值得在首屏之后立刻出现一次。
 *
 * 它刻意做得很薄（一行、约 56–96px）：这是一块**提示**，不是第二个 hero。
 * 手机上是两行（说明 + 按钮），桌面是一行三段。
 *
 * 数字取 `VERDICT_COUNT` 而不是写死 363 —— 「条件性承诺」的判据是这句话是否
 * 描述了页面上的东西。这里承诺的是「有多少条人工判断」，条数会随数据变化，
 * 写死等于让它慢慢变成谎话（仓库里已经因此修过三处）。
 */
export function HomeDecideStrip() {
  return (
    <section
      aria-labelledby="home-decide-strip"
      className="border-b border-foreground/[0.07] bg-foreground/[0.02]"
    >
      <div className="content-container flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3.5 md:py-4">
        <h2
          id="home-decide-strip"
          className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          <Compass className="h-3.5 w-3.5 text-gongke-accent" aria-hidden="true" />
          决策台
        </h2>
        <p className="order-3 min-w-0 flex-1 basis-full text-[13px] leading-relaxed text-foreground/75 md:order-none md:basis-auto">
          不知道选哪个？
          <span className="font-medium text-foreground">三个问题</span>
          ，从 {VERDICT_COUNT} 条人工判断里缩到 3 个 —— 每条都写清楚
          <span className="text-foreground">「不适合谁」</span>。
        </p>
        <Link
          prefetch={false}
          href="/decide"
          data-testid="decide-home-strip"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gongke-accent/30 bg-card px-3.5 py-2 text-[13px] font-medium text-gongke-accent transition-all duration-200 hover:-translate-y-px hover:border-gongke-accent/50 hover:bg-gongke-accent/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          帮我选
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}
