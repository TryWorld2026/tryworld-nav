'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Check, Share2 } from 'lucide-react';
import { buttonOutline } from '@/lib/styles';
import {
  favoritesChangedEvent,
  isFavorite,
  readStore,
  toggleFavorite,
  writeStore,
} from '@/lib/favorites';

/**
 * 工具详情的 分享 / 添加收藏。
 *
 * 2026-10-18 改了两处，都是用户能直接感觉到的：
 *
 *   1. **收藏有了出口**。之前它只往 localStorage 写 slug，全站没有任何页面能
 *      读出来 —— 用户点了「已收藏」，刷新还在，却再也找不到这个工具
 *      （work/analysis-ia.md §9⑤）。现在写入的是**带快照的 v2 结构**
 *      （名称/简介/图标/主分类），`/favorites` 可以直接渲染，不需要再查目录。
 *      同时兼容 v1（纯 slug 数组）——老用户的收藏不会被清空。
 *
 *   2. **分享失败不再静默**。原实现在 `navigator.share` 不可用、
 *      `clipboard.writeText` 又被拒（非 HTTPS、权限被禁、headless 环境）时，
 *      只 `setCopied(false)`，按钮纹丝不动、剪贴板也空 —— 用户会以为站坏了。
 *      现在失败会把按钮文字改成「复制失败」，2 秒后复原，至少给了一个结果。
 *
 * 初始态在 effect 里读而不是渲染时读：`localStorage` 是浏览器 API，服务端
 * 预渲染阶段不存在，直接读会让预渲染 HTML 与首次客户端渲染不一致。
 */
export function ToolActions({
  slug,
  name,
  description,
  icon,
  category,
}: {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  category?: { slug: string; name: string; color: string };
}) {
  const [saved, setSaved] = useState(false);
  /** '' | 'copied' | 'failed' —— 分享的三种短暂状态。 */
  const [shareState, setShareState] = useState<'' | 'copied' | 'failed'>('');

  useEffect(() => {
    setSaved(isFavorite(readStore(), slug));
  }, [slug]);

  // 收藏页里移除后，回到详情页按钮要跟着变。
  useEffect(() => {
    const sync = () => setSaved(isFavorite(readStore(), slug));
    window.addEventListener(favoritesChangedEvent, sync);
    return () => window.removeEventListener(favoritesChangedEvent, sync);
  }, [slug]);

  useEffect(() => {
    if (!shareState) return;
    const timer = window.setTimeout(() => setShareState(''), 2000);
    return () => window.clearTimeout(timer);
  }, [shareState]);

  const onShare = useCallback(async () => {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: name, text: description, url });
        return;
      } catch {
        // 用户取消分享面板，或分享失败 —— 落到剪贴板这条路上，不要直接 return。
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
    } catch {
      setShareState('failed');
    }
  }, [description, name]);

  const onSave = useCallback(() => {
    const next = toggleFavorite(readStore(), {
      slug,
      name,
      description,
      icon: icon ?? '',
      ...(category ? { category } : {}),
    });
    writeStore(next.store);
    setSaved(next.added);
  }, [slug, name, description, icon, category]);

  const shareLabel =
    shareState === 'copied' ? '已复制链接' : shareState === 'failed' ? '复制失败' : '分享';

  return (
    <div className="flex items-center space-x-3">
      <button type="button" onClick={onShare} className={buttonOutline} aria-live="polite">
        {shareState === 'copied' ? (
          <Check className="h-[18px] w-[18px]" aria-hidden="true" />
        ) : (
          <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
        )}
        <span>{shareLabel}</span>
      </button>
      <button
        type="button"
        onClick={onSave}
        aria-pressed={saved}
        className={buttonOutline}
        title={saved ? '再点一次可取消收藏' : '收藏后可在「我的收藏」里找到'}
      >
        {saved ? (
          <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden="true" />
        ) : (
          <Bookmark className="h-[18px] w-[18px]" aria-hidden="true" />
        )}
        <span>{saved ? '已收藏' : '添加收藏'}</span>
      </button>
    </div>
  );
}
