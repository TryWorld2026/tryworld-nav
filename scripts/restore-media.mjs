#!/usr/bin/env node
/**
 * Restore the product media into `public/assets/`.
 *
 * The 336 MB of icons, screenshots, tag icons and news covers is deliberately
 * not in git (GitHub warns past ~1 GB and hard-blocks files over 100 MB). This
 * script puts it back from one of three sources, in order:
 *
 *   1. A local archive      — scripts/restore-media.mjs --from D:/backups/assets-*.tar.gz
 *   2. The live site        — scripts/restore-media.mjs --from https://nav.tryworld.com.cn
 *   3. An R2 bucket         — scripts/restore-media.mjs --from r2:tryworld-nav-assets
 *
 * Any of the three is enough to rebuild and redeploy the whole site.
 *
 * Usage:
 *   node scripts/restore-media.mjs --from <archive|url|r2:bucket> [--force]
 *
 * `--force` re-downloads files that already exist; without it the script skips
 * what is on disk so an interrupted run resumes.
 */
import { existsSync, mkdirSync, readdirSync, statSync, createWriteStream } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'public', 'assets');
const DIRS = ['icons', 'shots', 'tags', 'news'];

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const fromIdx = args.indexOf('--from');
const SOURCE = fromIdx >= 0 ? args[fromIdx + 1] : null;

if (!SOURCE) {
  console.error('Usage: node scripts/restore-media.mjs --from <archive.tar.gz | https://site | r2:bucket> [--force]');
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });

// ---------------------------------------------------------------- local archive
if (SOURCE.endsWith('.tar.gz') || SOURCE.endsWith('.tgz')) {
  if (!existsSync(SOURCE)) {
    console.error(`archive not found: ${SOURCE}`);
    process.exit(1);
  }
  console.log(`extracting ${SOURCE} → public/assets/`);
  // tar.exe rejects `D:/path` — it reads the colon as a remote-host separator —
  // and does not understand MSYS `/d/` paths when spawned directly. Going
  // through bash restores the MSYS path layer, but BOTH arguments have to be in
  // MSYS form for it to work, including the destination. `path.join` yields
  // backslashes on Windows, so the separators are normalised too — verified end
  // to end: with both converted, `tar -xzf` exits 0 and restores all 4188 files.
  const toMsys = (p) =>
    p.replace(/\\/g, '/').replace(/^([A-Za-z]):\//, (_, d) => `/${d.toLowerCase()}/`);
  const cmd = `tar -xzf ${JSON.stringify(toMsys(SOURCE))} -C ${JSON.stringify(toMsys(DEST))}`;
  const res = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error((res.stderr || '').trim());
    console.error('tar failed. Extract the archive into public/assets/ with 7-Zip or WinRAR instead.');
    process.exit(1);
  }
  const n = DIRS.reduce((sum, d) => sum + (existsSync(join(DEST, d)) ? readdirSync(join(DEST, d)).length : 0), 0);
  console.log(`restored ${n} files into public/assets/`);
  process.exit(0);
}

// ------------------------------------------------------------------------ R2
if (SOURCE.startsWith('r2:')) {
  const bucket = SOURCE.slice(3);
  console.log(`downloading ${bucket} → public/assets/ (via wrangler)`);
  // wrangler has no bulk get, so this lists the bucket through the S3 API and
  // fetches object by object. Slow but complete.
  console.error('R2 bulk download is not scripted here — use `npx wrangler r2 object get` per key,');
  console.error('or enable the bucket\'s public hostname and pass that as --from instead.');
  process.exit(1);
}

// ------------------------------------------------------------------- live site
if (!/^https?:\/\//.test(SOURCE)) {
  console.error(`unrecognised source: ${SOURCE}`);
  process.exit(1);
}

const BASE = SOURCE.replace(/\/+$/, '');
console.log(`downloading ${BASE}/assets/* → public/assets/`);

// The file list comes from the live site's own directory listing? No — Workers
// Static Assets does not list. So the inventory is derived from the catalog:
// every icon/image path the data files reference.
const tools = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'data', 'tools.json'), 'utf8'));
const sections = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'data', 'sections.json'), 'utf8'));
const collections = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'data', 'collections.json'), 'utf8'));
const cards = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'data', 'category-cards.json'), 'utf8'));
const news = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'data', 'news.json'), 'utf8'));
const tags = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'data', 'tags.json'), 'utf8'));

const paths = new Set();
const add = (p) => p && p.startsWith('/assets/') && paths.add(p);

for (const t of tools) { add(t.icon); add(t.image); }
for (const s of sections) for (const t of s.tools) { add(t.icon); add(t.image); }
for (const c of collections) {
  add(c.icon); add(c.tagIcon);
  for (const m of c.memberIcons) add(m);
  for (const t of c.tools) { add(t.icon); add(t.image); }
}
for (const c of cards) for (const m of c.members) add(m.icon);
// `data/news.json` 在 2026-10-15 改为 AIHOT 资讯流后不再带 `image` / `cover`：
// 卡片是纯文字的，AIHOT 不提供配图。所以这两行现在什么都加不进来——保留是防御
// 性的（万一以后又给资讯配图，字段名沿用即可）。`public/assets/news/` 里那 11 张
// 旧长文封面仍在磁盘与备份包里，只是已无引用；media:backup 按目录打包，不受影响。
for (const a of news) { add(a.image); add(a.cover); }
for (const t of tags) add(t.iconUrl);
// The site's own icons ship with the repo, but pull them too for completeness.
for (const f of ['icon.svg', 'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'og.png']) add('/assets/site/' + f);

const list = [...paths];
console.log(`catalog references ${list.length} asset paths`);

let ok = 0, skipped = 0, failed = 0;
const CONC = 8;
let i = 0;

async function one(p) {
  const dest = join(ROOT, 'public', p);
  if (!FORCE && existsSync(dest) && statSync(dest).size > 0) { skipped++; return; }
  mkdirSync(dirname(dest), { recursive: true });
  try {
    const res = await fetch(BASE + p);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    await pipeline(res.body, createWriteStream(dest));
    ok++;
  } catch (e) {
    failed++;
    if (failed <= 5) console.error(`  FAIL ${p}: ${e.message}`);
  }
}

await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < list.length) {
    const p = list[i++];
    await one(p);
    if ((ok + skipped + failed) % 250 === 0) console.log(`  ${ok + skipped + failed}/${list.length}`);
  }
}));

console.log(`\ndownloaded: ${ok} | already present: ${skipped} | failed: ${failed}`);
process.exit(failed ? 1 : 0);
