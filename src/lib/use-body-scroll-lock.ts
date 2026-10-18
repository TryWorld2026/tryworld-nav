'use client';

import { useEffect } from 'react';

/**
 * 弹窗/抽屉打开时锁住页面滚动。
 *
 * 为什么需要：`Ctrl+K` 搜索面板声明了 `aria-modal="true"`，但实测打开后
 * `body` 仍是 `overflow: visible`，`window.scrollBy(0, 400)` 照样生效
 * （work/analysis-perf.md §7）。屏幕阅读器与键盘用户被 promise 了「背景
 * 不可交互」，实际却可以滚走 —— 打开面板后往下一滚，面板还浮在视口里，
 * 底下的内容却在动。
 *
 * 实现要点：
 *   - 用 `overflow: hidden` 而不是 `position: fixed`：后者在 iOS 上会让
 *     页面跳回顶部；
 *   - 记下**原来的值**再还原，避免与另一个弹层（移动抽屉）抢着改 body；
 *   - 用计数而不是布尔：两个弹层可能同时想锁（抽屉里再开搜索），先关的那个
 *     不能把后关的锁解开。
 */

let lockCount = 0;
let previousOverflow = '';

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    if (lockCount === 0) {
      previousOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        body.style.overflow = previousOverflow;
      }
    };
  }, [locked]);
}
