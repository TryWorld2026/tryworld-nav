#!/usr/bin/env node
/**
 * Prune the deploy payload in `out/` before uploading to Cloudflare.
 *
 * Two things get removed, both optional:
 *
 *   1. R2-hosted media (`assets/{icons,shots,tags,news}`) — always. The build
 *      copies everything from `public/`, and locally that is 327 MB of product
 *      screenshots. In CI those directories do not exist (gitignored), so this
 *      is a no-op there; locally it stops a 327 MB duplicate upload.
 *
 *   2. RSC payloads (`**\/*.txt`) — only with `--lean`. Next emits one next to
 *      every page so its client router can navigate without a full page load.
 *      Deleting them makes navigation fall back to MPA (verified: links still
 *      work, no console errors), which saves 240 MB — a third of the payload —
 *      at the cost of prefetching and instant transitions.
 *
 * Usage:
 *   node scripts/prune-out.mjs            # media only (default)
 *   node scripts/prune-out.mjs --lean     # media + RSC payloads
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const LEAN = process.argv.includes('--lean');

const MEDIA = ['assets/icons', 'assets/shots', 'assets/tags', 'assets/news'];

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

// ---- 2. RSC payloads, opt-in ----
if (LEAN) {
  const txts = findFiles(OUT, '.txt');
  let bytes = 0;
  for (const p of txts) {
    bytes += statSync(p).size;
    rmSync(p, { force: true });
  }
  freed += bytes;
  console.log(`  removed ${txts.length} RSC payloads (${(bytes / 1048576).toFixed(0)} MB)`);
  console.log('  navigation now falls back to full page loads');
} else {
  const n = findFiles(OUT, '.txt').length;
  console.log(`  kept ${n} RSC payloads (client-side nav; use --lean to drop them)`);
}

console.log(`\nfreed ${(freed / 1048576).toFixed(0)} MB from the deploy payload`);
