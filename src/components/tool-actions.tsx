'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Check, Share2 } from 'lucide-react';
import { buttonOutline } from '@/lib/styles';

/**
 * The origin's 分享 / 添加收藏 pair.
 *
 * On the origin these two are dead buttons — clicking either does nothing at
 * all. Shipping them that way would make the replica worse than the thing it
 * copies, so both are wired to real behaviour here:
 *
 *   • 分享 — `navigator.share` where the browser offers it (mobile Safari,
 *     Android Chrome), falling back to writing the URL to the clipboard. Either
 *     way the label flips to 已复制 for a moment so the click has an outcome.
 *   • 添加收藏 — a localStorage-backed bookmark list under `tryworld:favorites`.
 *     It is per-device and never leaves the browser; there is no account to
 *     sync it to, and inventing one would be a bigger lie than a dead button.
 *
 * Both read their initial state in an effect rather than during render: the
 * clipboard and storage APIs are browser-only, and rendering from them directly
 * would make the prerendered HTML disagree with the first client render.
 */

const STORAGE_KEY = 'tryworld:favorites';

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    // Private-browsing modes and disabled storage throw rather than returning
    // null; an unreadable bookmark list is not worth failing the page over.
    return [];
  }
}

function writeFavorites(slugs: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    // Let anything else on the page that cares about bookmarks react without a
    // prop-drilled store.
    window.dispatchEvent(new CustomEvent('tryworld:favorites-changed'));
  } catch {
    /* storage full or unavailable — the in-memory state still updates */
  }
}

export function ToolActions({
  slug,
  name,
  description,
}: {
  slug: string;
  name: string;
  description: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSaved(readFavorites().includes(slug));
  }, [slug]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onShare = useCallback(async () => {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: name, text: description, url });
        return;
      } catch {
        // The user dismissed the sheet, or the share failed — either way fall
        // through to the clipboard rather than doing nothing.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [description, name]);

  const onSave = useCallback(() => {
    const current = readFavorites();
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    writeFavorites(next);
    setSaved(next.includes(slug));
  }, [slug]);

  return (
    <div className="flex items-center space-x-3">
      <button type="button" onClick={onShare} className={buttonOutline}>
        {copied ? <Check className="h-[18px] w-[18px]" /> : <Share2 className="h-[18px] w-[18px]" />}
        <span>{copied ? '已复制' : '分享'}</span>
      </button>
      <button
        type="button"
        onClick={onSave}
        aria-pressed={saved}
        className={buttonOutline}
      >
        {saved ? (
          <BookmarkCheck className="h-[18px] w-[18px]" />
        ) : (
          <Bookmark className="h-[18px] w-[18px]" />
        )}
        <span>{saved ? '已收藏' : '添加收藏'}</span>
      </button>
    </div>
  );
}
