'use client';

import { useEffect, useState } from 'react';

/**
 * 当前平台的主修饰键 —— macOS / iOS 是 `⌘`，其余是 `Ctrl`。
 *
 * 为什么要有状态：快捷键本身两个键都认（`e.metaKey || e.ctrlKey`），
 * 但提示写死 `⌘K` 会让 Windows/Linux 用户按了没反应 —— 而本站读者
 * 大多数在 Windows 上。服务端不知道客户端平台，所以先渲染 `Ctrl`，
 * 挂载后再纠正；差异只有一个 kbd 徽章，不会造成可见跳动。
 *
 * 抽成 hook 是因为页眉与首页 hero 的搜索入口都要显示同一个提示，
 * 两处各写一遍就会有一天只改了一处（一个显示 ⌘ 一个显示 Ctrl）。
 */
export function useModKey(): string {
  const [modKey, setModKey] = useState('Ctrl');

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const ua = nav.userAgentData?.platform || nav.platform || nav.userAgent;
    if (/mac|iphone|ipad|ipod/i.test(ua)) setModKey('⌘');
  }, []);

  return modKey;
}
