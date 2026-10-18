'use client';

import { useEffect } from 'react';

/**
 * 把归档栏里「当前这一期」滚进可视区。
 *
 * 为什么需要它：`DailyArchive` 的左栏是 `max-h-[calc(100vh-9rem)]` +
 * `overflow-y-auto` 的固定高度盒子，里面是十几个按月折叠的分组、几百行日期。
 * 服务端会把当前月的分组展开（`open={g.key === curMonth}`），但**展开不等于
 * 可见** —— 读到 2026-03 的一期时，3 月那一组在盒子里第 7 屏，左栏停在
 * 「2026-10 / 2026-09 …」的最顶上，`aria-current` 那一行在可视区外，读者看不到
 * 自己在哪里，这排归档就退化成了「一个很长的列表」。
 *
 * 为什么不在服务端算出 scrollTop：滚动位置取决于字体、行高和浏览器缩放，
 * 服务端不知道。只能在挂载后量一次。
 *
 * 为什么用 `scrollTop +=` 而不是 `scrollIntoView`：后者会把**所有**可滚动的
 * 祖先（包括 window）一起滚，进页面时整个文档会往下跳一屏。这里只动那个
 * 盒子，把当前项摆在中间。
 *
 * 只滚一次（空依赖），且只在确实看不见时才滚 —— 当前项本来就在视野里时
 * 不该出现任何位移。
 */
export function ArchiveScrollToCurrent() {
  useEffect(() => {
    const box = document.querySelector<HTMLElement>('[data-archive-scroll]');
    const cur = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !cur) return;

    const b = box.getBoundingClientRect();
    const c = cur.getBoundingClientRect();
    // 盒子被 `hidden lg:block` 藏起来时 rect 全是 0，直接退出。
    if (b.height === 0) return;
    if (c.top >= b.top && c.bottom <= b.bottom) return;

    box.scrollTop += c.top - b.top - box.clientHeight / 2 + c.height / 2;
  }, []);

  return null;
}
