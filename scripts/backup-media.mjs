#!/usr/bin/env node
/**
 * Back up `public/assets/{icons,shots,tags,news}` to a dated .tar.gz.
 *
 * The 336 MB of product media is not in git, so this archive is the only
 * restorable local copy. Run it after adding tools, and keep the result
 * somewhere that is not this machine.
 *
 * Usage:
 *   node scripts/backup-media.mjs [output-dir]
 *
 * Defaults to D:/tryworld-backups (a second physical drive) rather than the
 * project's own disk, so losing one does not lose both.
 */
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public', 'assets');
const DIRS = ['icons', 'shots', 'tags', 'news'];

const outDir = process.argv[2] ?? 'D:/tryworld-backups';
mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10);
const out = join(outDir, `assets-${stamp}.tar.gz`);

const present = DIRS.filter((d) => existsSync(join(ASSETS, d)));
if (present.length === 0) {
  console.error('nothing to back up — public/assets/{icons,shots,tags,news} are all absent.');
  console.error('Restore first:  npm run media:restore -- --from <archive|url>');
  process.exit(1);
}

const bytes = present.reduce((n, d) => n + dirSize(join(ASSETS, d)), 0);
console.log(`backing up ${present.length} dirs, ${(bytes / 1048576).toFixed(0)} MB → ${out}`);

function dirSize(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) n += dirSize(p);
    else n += statSync(p).size;
  }
  return n;
}

// Same MSYS path constraint as restore-media.mjs: tar.exe will not take `D:/`.
const toMsys = (p) =>
  p.replace(/\\/g, '/').replace(/^([A-Za-z]):\//, (_, d) => `/${d.toLowerCase()}/`);

const cmd = `tar -czf ${JSON.stringify(toMsys(out))} -C ${JSON.stringify(toMsys(ASSETS))} ${present.join(' ')}`;
const res = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });

if (res.status !== 0) {
  console.error((res.stderr || '').trim());
  process.exit(1);
}

const size = existsSync(out) ? statSync(out).size : 0;
console.log(`wrote ${out} (${(size / 1048576).toFixed(0)} MB)`);
console.log('\nKeep this somewhere that is not this machine.');
console.log('Restore with:  npm run media:restore -- --from ' + out);
