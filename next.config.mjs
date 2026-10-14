/** @type {import('next').NextConfig} */

/*
 * Static export.
 *
 * The site has no server-side behaviour left to run: every route is either
 * prerendered content or a client component that filters in the browser, so the
 * whole thing ships as files. That is what lets it go on Cloudflare Workers /
 * Pages with no Node runtime and no cold starts.
 *
 * Two consequences worth knowing:
 *
 *   - `images.unoptimized` — the optimizer is a Node server. Cloudflare Images
 *     would cost money and the two `next/image` uses are 800×450 article covers
 *     that are already small, so the browser gets the original file instead.
 *
 *   - `output: 'export'` rejects any route that touches `searchParams`,
 *     `cookies()`, `headers()` or Node built-ins at request time. `/tools` used
 *     to read `searchParams` server-side; it now reads the URL on the client
 *     (see components/tools-explorer.tsx), which is also what the origin does.
 */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // `trailingSlash` is left at Next's default (false), which is what Cloudflare
  // Pages and Workers Static Assets both expect.
};

export default nextConfig;
