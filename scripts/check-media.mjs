#!/usr/bin/env node
/**
 * Verify every `/assets/...` path referenced by `data/*.json` exists under
 * `public/assets`.
 *
 * The deploy workflow restores media from a GitHub Release snapshot
 * (`MEDIA_VERSION`). A stale snapshot still builds fine — the page just renders
 * broken images — so this check turns that into a failed deploy instead.
 *
 * It also catches case-only mismatches on CI's Linux runner, which a local
 * Windows checkout would silently accept.
 *
 * Usage:
 *   npm run media:check
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8'));

const referenced = new Set();
const add = (path) => {
  if (typeof path === 'string' && path.startsWith('/assets/')) referenced.add(path);
};
const addTool = (tool) => {
  add(tool?.icon);
  add(tool?.image);
};

for (const tool of read('tools.json')) addTool(tool);
for (const tag of read('tags.json')) add(tag.iconUrl);

for (const card of read('category-cards.json')) {
  add(card.icon);
  for (const member of card.members ?? []) add(member.icon);
}

for (const collection of read('collections.json')) {
  add(collection.icon);
  add(collection.tagIcon);
  for (const icon of collection.memberIcons ?? []) add(icon);
  for (const tool of collection.tools ?? []) addTool(tool);
}

for (const item of read('featured.json')) addTool(item);

for (const section of read('sections.json')) {
  add(section.icon);
  for (const tool of section.tools ?? []) addTool(tool);
}

const missing = [...referenced].filter(
  (path) => !existsSync(join(ROOT, 'public', path)),
);

if (missing.length > 0) {
  console.error(`missing ${missing.length} referenced media file(s):`);
  for (const path of missing.slice(0, 20)) console.error(`  ${path}`);
  if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
  console.error(
    '\nThe media snapshot is stale. Re-run `npm run media:backup`, publish a new ' +
      'GitHub Release, and update the MEDIA_VERSION repository variable.',
  );
  process.exit(1);
}

console.log(
  `media check OK: ${referenced.size} referenced files exist under public/assets`,
);
