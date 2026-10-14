/**
 * Census over `data/`, printed as one `KEY=VALUE` per line.
 *
 * Several source comments quote per-field coverage counts (pricing tones,
 * `info` / `platforms` presence, dead references in `more`/`related`/`latest`)
 * that were true of an earlier 1150-slug harvest. Re-running this script after
 * every re-harvest keeps those comments honest instead of letting them drift
 * again — the numbers are copied from its output by hand.
 *
 * Usage: node scripts/census.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readJson(name) {
  return JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));
}

const tools = readJson('tools.json');
const extras = readJson('tool-extras.json');
const slugs = new Set(tools.map((t) => t.slug));
const keys = Object.keys(extras);

const inCatalog = keys.filter((k) => slugs.has(k));
const count = (pred) => keys.filter(pred).length;
const present = (key) => count((k) => {
  const v = extras[k][key];
  return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.length > 0;
});

const tones = {};
for (const k of keys) {
  const label = extras[k].pricing || '(none)';
  tones[label] = (tones[label] || 0) + 1;
}

// `more` / `related` / `latest` are provenance-only snapshots of the origin's
// own widgets. The number that matters is how many of their slugs this catalog
// cannot resolve, because that is what makes adopting them verbatim unsafe.
const deadRefs = {};
for (const field of ['more', 'related', 'latest']) {
  let refs = 0;
  let dead = 0;
  for (const k of keys) {
    const list = extras[k][field];
    if (!Array.isArray(list)) continue;
    refs += list.length;
    dead += list.filter((s) => !slugs.has(s)).length;
  }
  deadRefs[field] = { refs, dead, pct: refs ? Number(((dead / refs) * 100).toFixed(2)) : 0 };
}

const proseChars = keys.reduce((sum, k) => {
  const p = extras[k].prose;
  return typeof p === 'string' ? sum + p.length : sum;
}, 0);

const out = {
  tools: tools.length,
  extras: keys.length,
  extrasInCatalog: inCatalog.length,
  catalogMissingExtras: [...slugs].filter((s) => !extras[s]).length,
  prose: present('prose'),
  external: present('external'),
  updated: present('updated'),
  description: present('description'),
  info: present('info'),
  platforms: present('platforms'),
  noProseSlugs: keys.filter((k) => typeof extras[k].prose !== 'string').join(','),
  noDescriptionSlugs: keys.filter((k) => !extras[k].description).join(','),
  unknownPricingSlugs: keys.filter((k) => extras[k].pricing === '未知').join(','),
  pricingTones: Object.entries(tones)
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${label} ${n}`)
    .join(', '),
  deadRefs,
  proseChars,
  extrasBytes: readFileSync(join(root, 'data', 'tool-extras.json')).length,
};

for (const [k, v] of Object.entries(out)) {
  console.log(`${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
}
