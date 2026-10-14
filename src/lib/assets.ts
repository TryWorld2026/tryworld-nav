/**
 * Resolve a site-relative asset path against the media host.
 *
 * The catalog stores assets as `/assets/…`, which is correct for local dev and
 * keeps `data/*.json` portable. In production the 336 MB of product icons and
 * screenshots live on Cloudflare R2 rather than in the git repo, so the same
 * path has to resolve against that host instead.
 *
 * `NEXT_PUBLIC_` is inlined at build time, which is what makes this work under
 * `output: 'export'` — there is no server to read an env var at request time.
 * Unset (local dev, `next dev`), the prefix is empty and paths stay relative.
 *
 *   NEXT_PUBLIC_ASSET_BASE=https://assets.example.com  → absolute
 *   (unset)                                            → /assets/icons/x.png
 */
const BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? '').replace(/\/+$/, '');

/** Prefix one path. Non-`/assets` paths (and already-absolute ones) pass through. */
export function asset(path: string | undefined | null): string {
  if (!path) return '';
  if (!path.startsWith('/assets/')) return path;
  return BASE ? BASE + path : path;
}

/** Prefix a list of paths, dropping empties. */
export function assetList(paths: readonly string[] | undefined | null): string[] {
  if (!paths) return [];
  return paths.map(asset).filter(Boolean);
}
