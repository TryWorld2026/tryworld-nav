#!/usr/bin/env node
/**
 * Upload `public/assets/**` to a Cloudflare R2 bucket.
 *
 * The catalog's media (2082 product icons + 2081 screenshots + 9 tag icons +
 * news covers + site icons — 336 MB across 4188 files) does not belong in git.
 * It goes to R2, is served from a public hostname, and the build points at it
 * through NEXT_PUBLIC_ASSET_BASE.
 *
 * Usage:
 *   node scripts/sync-assets.mjs --check     # report only, upload nothing
 *   node scripts/sync-assets.mjs             # upload every file
 *
 * Requires wrangler (`npm i -D wrangler`) and either a `wrangler login` session
 * or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment (CI sets
 * the latter).
 *
 * Uploads are not incremental: wrangler's object interface has no bulk list, so
 * deciding what changed would cost as many round trips as uploading does. At
 * ~4200 small files this finishes in a few minutes and is only run when media
 * actually changes.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public', 'assets');
const BUCKET = process.env.R2_BUCKET ?? 'tryworld-nav-assets';
const CHECK = process.argv.includes('--check');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function wrangler(args) {
  return spawnSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

const local = walk(ASSETS);
const bytes = local.reduce((n, p) => n + statSync(p).size, 0);
console.log(`local assets: ${local.length} files, ${(bytes / 1048576).toFixed(0)} MB`);
console.log(`target bucket: ${BUCKET}`);

if (CHECK) {
  console.log('\n--check: nothing uploaded.');
  process.exit(0);
}

const probe = wrangler(['r2', 'bucket', 'list']);
if (probe.status !== 0) {
  console.error('\nCould not reach Cloudflare. Either run `npx wrangler login`,');
  console.error('or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.');
  process.exit(1);
}

let ok = 0;
const failures = [];
for (const p of local) {
  const key = relative(ASSETS, p).split(sep).join('/');
  const res = wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', p]);
  if (res.status === 0) ok++;
  else failures.push(key);
  if ((ok + failures.length) % 500 === 0) console.log(`  ${ok + failures.length}/${local.length}`);
}

console.log(`\nuploaded: ${ok} | failed: ${failures.length}`);
if (failures.length) {
  console.error(failures.slice(0, 10).join('\n'));
  process.exit(1);
}
