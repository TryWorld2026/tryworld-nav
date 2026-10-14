import rawTags from '../../data/tags.json';
import { asset } from './assets';
import type { Tag } from './types';

/**
 * The nine 标签.
 *
 * This lives in its own module rather than in `lib/data.ts` because
 * `ToolMiniCard` reads `tagByName` and that component is pulled into the client
 * bundle by `ToolsExplorer`. Importing `lib/data` there instead would drag the
 * whole catalog (tools, collections, news, 8 MB of tool extras) across the
 * wire with it; `tags.json` is 3 KB, so the card can afford the direct import.
 */
export const tags = (rawTags as Tag[]).map((t) => ({ ...t, iconUrl: asset(t.iconUrl) }));

/**
 * Keyed by display name: `Tool.tags` carries names (`编辑推荐`), not slugs,
 * because that is what the origin's own card payload embeds — so the card's
 * tag-chip row needs this bridge to reach each tag's local icon.
 */
export const tagByName = new Map(tags.map((t) => [t.name, t]));
