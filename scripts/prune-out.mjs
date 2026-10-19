#!/usr/bin/env node
/**
 * Prune the deploy payload in `out/` before uploading to Cloudflare.
 *
 * Two things get removed, both optional:
 *
 *   1. R2-hosted media (`assets/{icons,shots,tags,news}`) — only with
 *      `--prune-media`, and only when `NEXT_PUBLIC_ASSET_BASE` is set. The
 *      build copies everything from `public/`, and locally that is 327 MB of
 *      product screenshots. Until R2 is enabled those files are the live
 *      site's only copy, because Workers Static Assets replaces the whole
 *      asset manifest on deploy — so the default is now to keep them, and
 *      dropping them is an explicit opt-in.
 *
 *   2. RSC payloads (`**\/*.txt`) — only with `--lean`. Next emits one next to
 *      every page so its client router can navigate without a full page load.
 *      Deleting them makes navigation fall back to MPA (verified: links still
 *      work, no console errors), which saves 240 MB — a third of the payload —
 *      at the cost of prefetching and instant transitions.
 *
 * `--lean` keeps a whitelist of hand-written `.txt` files that are not RSC
 * payloads: both are advertised by `src/app/robots.txt/route.ts`
 * (`LLM-Content`, `LLM-Full-Content`) and copied verbatim out of `public/`,
 * so deleting them would turn a declared URL into a 404.
 *
 * Usage:
 *   node scripts/prune-out.mjs            # keep media, keep RSC payloads
 *   node scripts/prune-out.mjs --lean     # keep media, drop RSC payloads
 *   node scripts/prune-out.mjs --prune-media   # drop media (needs R2)
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const LEAN = process.argv.includes('--lean');
const PRUNE_MEDIA = process.argv.includes('--prune-media');

// The media is only safe to drop when it is served from somewhere else. Today
// it is not: `NEXT_PUBLIC_ASSET_BASE` is unset, so every `asset()` call in
// src/lib/assets.ts returns a site-relative `/assets/...` path, and the only
// thing serving those files is this Worker's own asset manifest. Workers
// Static Assets replaces that manifest wholesale on deploy, so pruning the
// media here turns all 4188 product images into 404s on the live site.
// `--prune-media` is the escape hatch for the day R2 is enabled.
if (PRUNE_MEDIA && !process.env.NEXT_PUBLIC_ASSET_BASE) {
  console.error(
    'refusing to prune media: NEXT_PUBLIC_ASSET_BASE is unset, so /assets/* ' +
      'is served by this Worker. Set it to the media host and rebuild first.',
  );
  process.exit(1);
}

const MEDIA = ['assets/icons', 'assets/shots', 'assets/tags', 'assets/news'];

// Hand-written text files that live in `out/` by design. A `**/*.txt` glob
// catches them by accident, and they are indistinguishable from RSC payloads
// by extension alone.
//
// `robots.txt` 必须在列：它是 `src/app/robots.txt/route.ts` 产出的路由文件，
// 扩展名同样是 `.txt`。2026-10-19 第一次真跑 `--lean` 时它被当成 RSC 载荷
// 删掉了 —— 线上 robots.txt 会直接 404，而 sitemap 声明、爬虫策略、
// `LLM-Content` 两个非标准指令全在那份文件里，等于把整站对搜索引擎的说明
// 一起删掉。这个错误在 dry-run 里看不出来（只打印"删了 2337 个"），所以
// 白名单必须显式覆盖**所有**手写的 `.txt`。
const KEEP_TXT = ['llms.txt', 'llms-full.txt', 'robots.txt'];
const isKept = (p) => KEEP_TXT.includes(basename(p));

function dirSize(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) n += dirSize(p);
    else n += statSync(p).size;
  }
  return n;
}

function findFiles(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) findFiles(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

if (!existsSync(OUT)) {
  console.error('out/ does not exist — run `npm run build` first.');
  process.exit(1);
}

let freed = 0;

// ---- 1. R2-hosted media ----
if (PRUNE_MEDIA) {
  let removed = 0;
  for (const rel of MEDIA) {
    const p = join(OUT, rel);
    if (!existsSync(p)) continue;
    const size = dirSize(p);
    rmSync(p, { recursive: true, force: true });
    freed += size;
    removed++;
    console.log(`  removed out/${rel} (${(size / 1048576).toFixed(0)} MB)`);
  }
  if (removed === 0) console.log('  media: nothing to prune (already absent)');
} else {
  const present = MEDIA.filter((rel) => existsSync(join(OUT, rel)));
  const bytes = present.reduce((n, rel) => n + dirSize(join(OUT, rel)), 0);
  const files = present.reduce((n, rel) => n + findFiles(join(OUT, rel), '').length, 0);
  if (present.length) {
    console.log(
      `  media: KEPT ${files} files / ${(bytes / 1048576).toFixed(0)} MB — ` +
        'NEXT_PUBLIC_ASSET_BASE is unset, so /assets/* is served by this Worker',
    );
  } else {
    console.log('  media: nothing to keep (already absent)');
  }
}

// ---- 2. RSC payloads, opt-in ----
if (LEAN) {
  const txts = findFiles(OUT, '.txt').filter((p) => !isKept(p));
  let bytes = 0;
  for (const p of txts) {
    bytes += statSync(p).size;
    rmSync(p, { force: true });
  }
  for (const p of findFiles(OUT, '.txt').filter(isKept)) {
    console.log(`  kept ${relative(OUT, p)} (declared in robots.txt)`);
  }
  freed += bytes;
  console.log(`  removed ${txts.length} RSC payloads (${(bytes / 1048576).toFixed(0)} MB)`);
  console.log('  navigation now falls back to full page loads');
} else {
  const all = findFiles(OUT, '.txt');
  const n = all.filter((p) => !isKept(p)).length;
  console.log(`  kept ${n} RSC payloads (client-side nav; use --lean to drop them)`);
  for (const p of all.filter(isKept)) {
    console.log(`  kept ${relative(OUT, p)} (declared in robots.txt)`);
  }
}

console.log(`\nfreed ${(freed / 1048576).toFixed(0)} MB from the deploy payload`);
