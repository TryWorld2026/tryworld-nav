import Script from 'next/script';

/**
 * One AdSense slot, in the origin's own footprint.
 *
 * The origin runs two slots on every tool page — one in the content column
 * below the intro, one at the top of the right rail — under publisher
 * `ca-pub-3128385017768065`, slots `2176275884` and `3461578336`.
 *
 * This replica deliberately does **not** ship that publisher id: it is the
 * origin's AdSense account, and rendering someone else's `data-ad-client` on a
 * copy of their site would serve their ads from a host they do not control and
 * accrue impressions to an account we have no claim to. The slot stays inert
 * until an operator supplies their own:
 *
 *   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…            # publisher id
 *   NEXT_PUBLIC_ADSENSE_SLOT_INCONTENT=…           # replaces 2176275884
 *   NEXT_PUBLIC_ADSENSE_SLOT_RAIL=…                # replaces 3461578336
 *
 * With those unset — the default — the slot renders **nothing at all**.
 *
 * 2026-10-18：这里原先渲染一个 90px 的虚线「广告位」空盒。2081 个工具页的
 * 右栏首屏、以及正文中段，最显眼的都是这块写着「广告位」的框 —— 读者看到
 * 的不是「留白有节奏」，而是「页面没做完、广告没卖出去」。空占位对没有广告
 * 的公开构建没有任何收益，所以改成直接返回 `null`：两处调用点都不用动，
 * 右栏里的 `adsense-container` 变成一个零高空节点，`ToolInfoPanel` 自然
 * 顶到栏首。将来接上真实的 `NEXT_PUBLIC_ADSENSE_CLIENT`，下面的 `<ins>`
 * 分支照常工作。
 */
export function AdSlot({
  slot,
  className,
}: {
  /** The AdSense ad-slot id this position corresponds to. */
  slot: string;
  /** Classes for the outer wrapper — the origin's two wrappers differ. */
  className?: string;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  // 没有 publisher id 就不占位 —— 理由见文件头。返回 null 而不是空 div，
  // 让调用点的 `mb-4 mt-8` / `space-y-5` 也不会留下幽灵间距。
  if (!client) return null;

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      {/* The loader is idempotent — AdSense ignores a second include — so it
          is safe to emit once per slot rather than hoisting it to the root
          layout, where it would load on pages that have no ads at all. */}
      <Script
        id={`adsbygoogle-${slot}`}
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </div>
  );
}
