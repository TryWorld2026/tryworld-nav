export type Category = {
  id: string;
  slug: string;
  name: string;
  rawName: string;
  icon: string;
  color: string;
  tailwind: string;
  hot: boolean;
  order: number;
};

export type Tool = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  variant: string;
  /** Canonical internal route from the source payload (always /tools/{slug}). */
  link: string;
  tags: string[];
  categories: {
    id: string;
    slug: string;
    name: string;
    icon: string;
    color: string;
  }[];
};

/**
 * One of the nine 标签 chips.
 *
 * `iconUrl` is a local path under `public/assets/tags/`, named by `slug` — the
 * icons were mirrored off the upstream CDN at harvest time, so nothing here
 * fetches a remote host.
 *
 * `Tool.tags` carries tag *names* (`大厂出品`), not slugs, because that is the
 * shape the harvested payload uses — `tagByName` in `lib/tags.ts` bridges the two.
 */
export type Tag = {
  id: string;
  /** Hyphenated URL slug, e.g. `made-by-notable-companies`. */
  slug: string;
  /** Display name, e.g. `大厂出品`. */
  name: string;
  /** Longer label, e.g. `大厂旗下的AI产品` — falls back to `name`. */
  title: string;
  /** One-line blurb; empty on all nine today. */
  intro: string;
  /** Hand-written SEO description; empty on all nine today. */
  seo_description: string;
  /** Filename of the icon in its CDN bucket. */
  icon: string;
  /** Local icon path, `/assets/tags/{slug}.svg`. */
  iconUrl: string;
};

/**
 * One member of a 精选AI利器集合. The origin's collection cards are the magic-border
 * mini card, so a member carries the same shape as a catalog tool plus the tag
 * chips the collection page renders in place of category chips.
 */
export type CollectionTool = {
  slug: string;
  name: string;
  /** The one-line summary shown under the name. */
  summary: string;
  description: string;
  icon: string;
  image: string;
  /** Always `/tools/{slug}` — the origin links its members by absolute URL. */
  link: string;
  tags: {
    name: string;
    slug: string;
    /** Local copy at `/assets/tags/{slug}.svg`. */
    icon: string;
    color: string;
  }[];
};

export type Collection = {
  /** URL slug — hyphenated, unlike the tag's own underscore slug. */
  slug: string;
  /** Display name, e.g. 编辑推荐的AI产品. */
  name: string;
  title: string;
  /** The detail page's lead paragraph, verbatim from the origin. */
  intro: string;
  description: string;
  /** Local tag icon at `/assets/tags/{slug}.svg`. */
  icon: string;
  tagIcon: string;
  /**
   * The first six member icons, as local catalog paths — the strip the index
   * card renders. The origin links straight to the members' own CDN copies;
   * these are the same icons resolved against `tools.json`, so the strip
   * matches the grid it links into.
   */
  memberIcons: string[];
  /** The three collections listed in 其他集合, hyphenated slugs. */
  others: string[];
  toolCount: number;
  tools: CollectionTool[];
};

export type Featured = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  image: string;
  tags: string[];
  categories: unknown[];
  external?: string;
  /** Resolved destination — see the `featured` export in lib/data.ts. */
  href: string;
};

/**
 * One row of the 相关信息 panel. Every harvested row is labelled 开发者, but the
 * label is data rather than a constant so a future harvest with a second row kind
 * needs no type change.
 *
 * `href` and `logo` are optional because the origin has two row shapes: most
 * link the developer name out to its own site and carry a 16×16 brand favicon,
 * but a few (e.g. gemini-cli) render the name as plain text with neither.
 */
export type ToolInfoRow = {
  label: string;
  /** Hex colour of the row's leading dot, e.g. `#007BE9`. */
  dot: string;
  href?: string;
  text: string;
  /** Raw inline `<svg>` markup for the 16×16 favicon shown after the link text. */
  logo?: string;
};

/** One 支持平台 chip. `icon` is a raw inline `<svg>` string, 16×16. */
export type ToolPlatform = {
  name: string;
  icon: string;
};

/**
 * One entry of the 相关新闻 rail on a news article page. The origin renders the
 * same card shape there as on the index — title, summary, calendar + date — but
 * hoists the `time` element out of each link object into a sibling flight row,
 * so the dates below are cross-filled from the article that owns the slug.
 */
export type NewsRelated = {
  slug: string;
  href: string;
  title: string;
  summary: string;
  /** ISO timestamp the origin's `dateTime` attribute carries. */
  dateTime: string;
  /** Human label, e.g. `2025年8月14日 16:18`. */
  dateLabel: string;
};

/**
 * One AI新闻 article. `bodyHtml` is the origin's own HTML for the article body —
 * Feishu/Lark export markup, the same provenance as `ToolExtras.prose` and
 * injected the same way, so the same sanitisation contract applies: the harvest
 * pass kept no slug carrying a script/style/iframe/object/embed/form element, an
 * `on*` attribute or a `javascript:` URL.
 */
export type NewsArticle = {
  slug: string;
  href: string;
  title: string;
  /** Index-card summary; the detail page does not render it. */
  summary: string;
  /** Badge label — 新闻报道 on all ten. */
  category: string;
  /** `2025年8月14日` — the index card's date. */
  date: string;
  /** `2025/8/14` — the index card's footer date. */
  dateShort: string;
  /** Local cover image, `/assets/news/<file>`. */
  image: string;
  /** Index-card alt text. */
  alt: string;
  readMore: string;
  /** `<meta name="description">` of the origin's article page. */
  seoDescription: string;
  /** `<meta name="keywords">`, comma-joined. */
  keywords: string;
  dateTime: string;
  dateLabel: string;
  cover: string;
  coverAlt: string;
  bodyHtml: string;
  related: NewsRelated[];
};

/**
 * The tool-page copy and metadata harvested from the origin, keyed by slug in
 * `data/tool-extras.json`.
 *
 * `prose` is the origin's own HTML for the whole 产品介绍 body — verbatim, not a
 * re-derivation. It is rendered through `dangerouslySetInnerHTML` in ToolProse,
 * which is safe because the harvest pass rejects every slug carrying a
 * script/style/iframe/object/embed/form element, an `on*` attribute or a
 * `javascript:` URL (0 of 2081 slugs did). That contract lives in
 * `src/components/tool-details.tsx`. The coverage numbers quoted throughout
 * this file are the output of `node scripts/census.mjs`.
 *
 * `more` / `related` / `latest` are the origin's own per-page widget snapshots.
 * They are kept for provenance but are **not** used to render the page. Only
 * 18 of their 93,789 references name a slug this catalog cannot resolve
 * (`more` 12, `related` 6, `latest` 0 — 0.05% / 0.02% / 0%), so the dead-link
 * risk is small today, but the grids still cannot be adopted verbatim: they are
 * random samples on the origin, and `lib/data.ts` derives deterministic
 * replacements instead — see the note on `moreTools`.
 */
export type ToolExtras = {
  /**
   * The 产品介绍 body. Optional because one slug (pokecut) genuinely has none:
   * the origin's own page ships an empty `dangerouslySetInnerHTML`, so the
   * harvest has nothing to record. `ToolProse` renders nothing for it rather
   * than an empty shell.
   */
  prose?: string;
  /** Absolute https URL of the product's own site — the 访问官网 destination. */
  external?: string;
  /** Raw ISO timestamp the origin last touched the entry. */
  updated?: string;
  /**
   * The hero badge label — 免费 / 免费增值 / 付费 / 免费开源. Absent for the 39
   * slugs the origin renders no badge for. It cannot be derived from anything
   * else we hold; see `lib/pricing.ts`.
   */
  pricing?: string;
  /**
   * The long SEO paragraph from the origin's `<meta name="description">` — the
   * page's metadata description. Not the short tagline in `tools.json` and not
   * the first paragraph of `prose`: a separate hand-written blurb. Unset on
   * deta-surf and hyperspace, where the origin itself ships an empty one.
   */
  description?: string;
  /**
   * The 相关信息 rows. Present on 1155 of the 2081 slugs — the origin only
   * renders the panel for entries that carry a 开发者 row, so absence is
   * meaningful rather than a harvest gap. The tool page passes `?? []`.
   */
  info?: ToolInfoRow[];
  /** 支持平台 chips — present on 1513 of 2081 slugs, same reasoning as `info`. */
  platforms?: ToolPlatform[];
  /** Provenance only — see the note above. */
  more?: string[];
  related?: string[];
  latest?: string[];
};
