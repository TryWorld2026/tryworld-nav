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
 * With those unset — the default — each slot renders a dashed placeholder at
 * the same minimum height, so the page's vertical rhythm is preserved in
 * preview and it is obvious the gap is intentional rather than a broken image.
 *
 * The placeholder is `aria-hidden`: an empty labelled box is noise to a screen
 * reader, and the slot carries no content worth announcing.
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

  if (client) {
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

  return (
    <div className={className} aria-hidden="true">
      <div className="flex min-h-[90px] items-center justify-center rounded-lg border border-dashed border-muted text-[11px] text-muted-foreground">
        广告位
      </div>
    </div>
  );
}
