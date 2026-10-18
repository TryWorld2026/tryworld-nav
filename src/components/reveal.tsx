'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 滚动进入视口时的一次性淡入上浮。
 *
 * 为什么不用纯 CSS 动画：本站在静态导出下预渲染每一页，纯 CSS 的 `animation`
 * 会在**首屏之外的区块**也立刻跑完 —— 读者滚到那里时动画早结束了，等于没有。
 * 这里用 `IntersectionObserver` 在元素进入视口时才挂上 `data-in`，配合
 * `globals.css` 里的 `.reveal` 规则播放一次。
 *
 * 三个细节：
 *
 *   1. **首屏元素不应该等**：`rootMargin` 给 `-8%` 的下边距，元素露头到 8%
 *      才开始播，观感上像"跟上读者的节奏"；已经在首屏的会在第一次 observe
 *      回调里立刻触发。
 *   2. **只播一次**：`unobserve` 掉，往回滚不重播 —— 重播会让长页面显得躁。
 *   3. **无 JS / 减少动效时必须有内容**：`.reveal` 的初始态只有
 *      `translateY(10px)` 与 `opacity:0`，由 CSS 的
 *      `@media (prefers-reduced-motion: reduce)` 与 `html.js` 兜底 —— 但更稳的
 *      做法是这里在挂载后**无论如何**都设置 `data-in`，所以即使
 *      IntersectionObserver 不存在（老浏览器），内容也会在 effect 里显示。
 *
 * `delay` 用来给同组卡片做错峰（乘以 60ms）。
 */
export function Reveal({
  children,
  delay = 0,
  className,
  id,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  /** 错峰序号，实际延迟 = min(delay, 8) × 55ms。 */
  delay?: number;
  className?: string;
  /** 页内锚点目标（期报的栏目目录要跳到这些 block，见 `periodAnchor`）。 */
  id?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setShown(true);
      return;
    }
    // 不支持 IO 的环境直接显示，不能把内容困在 opacity:0 里。
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // 四种标签共享一个 ref 类型：`HTMLElement` 是它们的公共父类，赋给
      // `Ref<HTMLDivElement | HTMLLIElement | …>` 是安全的；JSX 的联合标签
      // 签名无法从外部收窄，这里用交叉类型而不是 `any`，保留类型检查。
      ref={ref as React.RefObject<HTMLDivElement & HTMLLIElement & HTMLElement>}
      id={id}
      data-in={shown ? 'true' : 'false'}
      className={`reveal ${className ?? ''}`}
      style={{ transitionDelay: `${Math.min(delay, 8) * 55}ms` }}
    >
      {children}
    </Tag>
  );
}
