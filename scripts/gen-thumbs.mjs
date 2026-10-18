#!/usr/bin/env node
/**
 * 生成缩略图：`public/assets/thumbs/{icons,shots}`。
 *
 * 为什么需要它 —— 媒体目录里放的是**原始尺寸**的图，而页面上的显示尺寸小得多：
 *
 *   - 工具图标在卡片里是 44×44、行卡里是 24×24，但 `public/assets/icons/`
 *     里的原稿中位数 6 KB、p90 22.9 KB、最大 1.25 MB（2082 个文件共 22 MB）；
 *   - 详情页截图容器实测渲染 501–1118 CSS px，而原稿宽 1270–3840（中位 1920）、
 *     平均 149 KB、最大 3840（2081 个文件共 303 MB）。
 *
 * 浏览器按 CSS 像素乘设备像素比去挑候选，一张 1250 KB 的 1024px 图标缩到 44px
 * 显示，解码与带宽全是浪费。这里预先生成 webp，页面用 `srcSet` 指过来
 * （见 `components/tool-card.tsx` 里的 `iconSrcSet` / `shotSrcSet`）。
 *
 *   node scripts/gen-thumbs.mjs              全量生成（已是最新的文件跳过）
 *   node scripts/gen-thumbs.mjs --limit 20   只处理前 20 个，用来验证脚本本身
 *   node scripts/gen-thumbs.mjs --force      忽略「输出比输入新」的跳过规则
 *
 * 输出的**命名规则必须与页面侧一致**（`thumbPath()` 在 tool-card.tsx）：
 *
 *   /assets/icons/{slug}.{png,jpg,jpeg,webp,avif,svg} → /assets/thumbs/icons/{slug}.webp      (88w)
 *                                                     → /assets/thumbs/icons/{slug}-176.webp  (176w)
 *   /assets/shots/{slug}.{…}                          → /assets/thumbs/shots/{slug}-800.webp  (800w)
 *
 * 图标两档的原因见下面 `ICON_SIZES` 的注释 —— 一句话：DPR3 手机上 88w 不够用，
 * 浏览器会去拿原图，而 icons/ 里最大一张 1.25 MB。
 *
 * 三个约定值得记下来：
 *
 * 1. **输出目录整体被 gitignore**（`/public/assets/thumbs`）。缩略图是产物不是
 *    资产，和 icons/shots 一样不在 git；重新生成只要一分钟。但它们会随
 *    `public/` 一起进 `out/`，所以部署前必须在本机跑过一次本次脚本。
 *
 * 2. **图标用 contain + 透明底，不用 cover。** 2082 个图标里有 17 个不是正方形
 *    （如 `reddo.svg` 640×539、`glishlish.jpeg` 178×189），cover 会把它们的边缘
 *    裁掉 —— logo 裁一刀比多出几 KB 糟得多。卡片里的 `<img>` 本来就是
 *    `object-contain`，缩略图跟着它走才不会变形。截图按宽度等比缩放，不裁。
 *
 * 3. **文件名里的 slug 与 tools.json 一致**，因为页面侧只能从原图路径反推：
 *    实测 2082 个图标 / 2081 张截图里，只有 1 个图标（`libtv`）不对应任何 slug，
 *    那是原站自己的孤儿文件，不会进页面。
 *
 * 只有**全量**跑完才写 `src/thumbs.json`。`--limit` 是验证模式，生成的残缺集合
 * 会让页面把 srcSet 指向不存在的文件，所以它不碰清单 —— 页面侧看到清单为 0
 * 就不输出 srcSet，自然退回原图。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'public', 'assets', 'icons');
const SHOTS = join(ROOT, 'public', 'assets', 'shots');
const THUMBS = join(ROOT, 'public', 'assets', 'thumbs');
const MANIFEST = join(ROOT, 'src', 'thumbs.json');

const argv = process.argv.slice(2);
const limitArg = argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(argv[limitArg + 1]) : 0;
const FORCE = argv.includes('--force');

/** 同一时刻最多几路 sharp；再高只会在小文件上抢 CPU，内存也涨。 */
const CONCURRENCY = 8;

/**
 * 图标要两档，不是一档。
 *
 * 卡片里的图标盒子是 44 CSS px。DPR1/2 需要 44/88 device px，88w 的缩略图正好
 * 够；但 **DPR3 的手机要 132px**，88w 不够，浏览器会在 88w 与「原图 176w」
 * 之间挑后者 —— 实测 DPR3 下 390 宽的首页，10 张可见图标全部退回原图
 * （48 KB vs 缩略图 8 KB），而 icons/ 里最大一张原图 1.25 MB，那是几十倍的差距。
 *
 * 176w 一档把 DPR4 也覆盖住（44×4=176）。代价量过：88w 平均 1.36 KB、176w 平均
 * 2.78 KB，全站 2082 个合计 2.8 MB → 5.7 MB。多出来的 2.9 MB 是**部署体积**，
 * 不是用户流量 —— 每张卡片实际只会下载其中一档。
 */
const ICON_SIZES = [88, 176];
const ICON_QUALITY = 80;

/**
 * 截图只做 800w 一档。
 *
 * 实测各档视口下这张图渲染 501/670/777/841/1011/1118 CSS px，800w 覆盖到
 * 1440 视口（含 DPR1 的 1440 与 DPR2 的 1280 以下）。再往上（1536+）浏览器
 * 会去拿原图，那时画质优先是对的 —— 那些屏幕本来就宽，而补一档 1600w 要给
 * 部署再加 2081 个文件、约 97 MB（实测 1600w q74 平均 47.6 KB），
 * 对「首屏 ≤1.9 MB」这个目标没有贡献（截图在首屏之下的懒加载区）。
 */
const SHOT_WIDTH = 800;
const SHOT_QUALITY = 78;

/**
 * svg 没有固有像素尺寸，sharp 会按 `density` 先栅格化再 resize。默认 72 dpi
 * 下小尺寸 svg 会被放大到 88 后再缩回来，边缘发糊；给 300 dpi 留足余量。
 * 位图不受这个参数影响。
 */
const svgDensity = (file) => (file.toLowerCase().endsWith('.svg') ? { density: 300 } : {});

const MEDIA_EXT = /\.(png|jpe?g|webp|avif|svg)$/i;

function listImages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => MEDIA_EXT.test(f));
}

/** `x.png` → `{ slug: 'x', file: 'x.png' }`。同名的两种格式只取第一个。 */
function bySlug(files) {
  const seen = new Map();
  for (const f of files.sort()) {
    const slug = f.replace(/\.[^.]+$/, '');
    if (!seen.has(slug)) seen.set(slug, f);
  }
  return seen;
}

const isFresh = (out, src) => !FORCE && existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs;

/**
 * 简单并发池。sharp 的 `process` 在 libvips 线程池里跑，Node 侧只是排队；
 * 8 路能把 IO 与 CPU 都喂满，同时不会像 `Promise.all(2082)` 那样一次性把
 * 全部文件读进内存（截图单张 300 KB，2082 张就是 600 MB 起步）。
 */
async function pool(items, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

function fmt(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function makeIcons() {
  const dir = join(THUMBS, 'icons');
  mkdirSync(dir, { recursive: true });
  let entries = [...bySlug(listImages(ICONS))];
  if (LIMIT) entries = entries.slice(0, LIMIT);

  let made = 0;
  let skipped = 0;
  let failed = 0;
  let inBytes = 0;
  let outBytes = 0;

  await pool(entries, async ([slug, file]) => {
    const src = join(ICONS, file);
    // 一档一个文件：`{slug}.webp`（88w）与 `{slug}-176.webp`（176w）。
    // 两个都要判断新旧 —— 只看 88w 的话，加了 176w 之后已生成的条目会被整批跳过。
    const targets = ICON_SIZES.map((size) => ({
      size,
      out: join(dir, size === ICON_SIZES[0] ? `${slug}.webp` : `${slug}-${size}.webp`),
    }));
    const todo = targets.filter((t) => !isFresh(t.out, src));
    if (todo.length === 0) {
      skipped += 1;
      return;
    }
    try {
      for (const t of todo) {
        await sharp(src, svgDensity(file))
          .resize(t.size, t.size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            withoutEnlargement: false,
          })
          .webp({ quality: ICON_QUALITY, alphaQuality: 90 })
          .toFile(t.out);
        outBytes += statSync(t.out).size;
      }
      inBytes += statSync(src).size;
      made += 1;
    } catch (err) {
      failed += 1;
      console.warn(`  [icons] ${file}: ${err.message}`);
    }
  });

  return { made, skipped, failed, inBytes, outBytes, total: entries.length };
}

async function makeShots() {
  const dir = join(THUMBS, 'shots');
  mkdirSync(dir, { recursive: true });
  let entries = [...bySlug(listImages(SHOTS))];
  if (LIMIT) entries = entries.slice(0, LIMIT);

  let made = 0;
  let skipped = 0;
  let failed = 0;
  let inBytes = 0;
  let outBytes = 0;

  await pool(entries, async ([slug, file]) => {
    const src = join(SHOTS, file);
    const out = join(dir, `${slug}-${SHOT_WIDTH}.webp`);
    if (isFresh(out, src)) {
      skipped += 1;
      return;
    }
    try {
      await sharp(src, svgDensity(file))
        // 只按宽度缩，高度由原图比例决定 —— 截图宽高比各不相同（4:3 / 16:9 /
        // 21:9 都有），固定高度框会把它们拉伸。
        .resize(SHOT_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: SHOT_QUALITY })
        .toFile(out);
      made += 1;
      inBytes += statSync(src).size;
      outBytes += statSync(out).size;
    } catch (err) {
      failed += 1;
      console.warn(`  [shots] ${file}: ${err.message}`);
    }
  });

  return { made, skipped, failed, inBytes, outBytes, total: entries.length };
}

function report(label, r) {
  const saved = r.inBytes ? `${Math.round((1 - r.outBytes / r.inBytes) * 100)}%` : '—';
  console.log(
    `  ${label}: 生成 ${r.made} / 跳过 ${r.skipped} / 失败 ${r.failed}` +
      (r.made ? `（本次 ${fmt(r.inBytes)} → ${fmt(r.outBytes)}，省 ${saved}）` : ''),
  );
}

/**
 * 写清单。只有全量跑才写：清单是页面「能不能用 srcSet」的开关，
 * 半量生成的集合会让 srcSet 指向不存在的文件。
 *
 * 为什么清单放在 `src/` 而不是 `data/`：`next.config.mjs` 的
 * `contentBuildId()` 只哈希 `src/` 与少数几个点名列出的 data 文件。清单变了
 * 会让页面 HTML 变（多出一批 srcSet 属性），却不会进 buildId —— 部署时
 * buildId 不变而 HTML 变，增量上传的判断将失去依据。放进 `src/` 就自动满足
 * 「影响页面字节的输入必须参与 buildId」这条约束。
 *
 * 计数口径是**完整的 slug 数**，不是文件数：图标有 88w / 176w 两个文件，
 * 只存在其中一个时 srcSet 里那条候选会 404，所以两个都在才算数。
 */
function writeManifest() {
  const iconDir = join(THUMBS, 'icons');
  const shotDir = join(THUMBS, 'shots');

  // 图标按**放大档**清点，再要求基础档存在。反过来数不行：`veo-3` 这个 slug
  // 让「基础档文件名以 -数字 结尾」这个判据失效（`veo-3.webp` 会被误当成
  // `veo-3-176.webp` 的编号档），而 `-176` 后缀只会由本脚本产生，没有歧义。
  const icons = existsSync(iconDir)
    ? readdirSync(iconDir).filter((f) => {
        if (!f.endsWith(`-${ICON_SIZES[1]}.webp`)) return false;
        return existsSync(join(iconDir, f.replace(new RegExp(`-${ICON_SIZES[1]}\\.webp$`), '.webp')));
      }).length
    : 0;

  // 截图只有 800w 一档，数全部 webp 就是 slug 数。
  const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => f.endsWith('.webp')).length : 0;

  writeFileSync(MANIFEST, `${JSON.stringify({ icons, shots }, null, 2)}\n`);
  console.log(`  清单 src/thumbs.json → {"icons":${icons},"shots":${shots}}`);
}

const started = Date.now();
console.log(
  `缩略图${LIMIT ? `（--limit ${LIMIT} 验证模式）` : ''}: 图标 ${ICON_SIZES.join('/')}px q${ICON_QUALITY} / 截图 ${SHOT_WIDTH}w q${SHOT_QUALITY}`,
);

const icons = await makeIcons();
report('icons', icons);
const shots = await makeShots();
report('shots', shots);

if (LIMIT) {
  console.log('  --limit 模式不写 src/thumbs.json（清单保持关闭，页面不会引用残缺集合）');
} else if (icons.failed || shots.failed) {
  console.log('  有失败项，清单不更新 —— 修掉失败再跑一次');
} else {
  writeManifest();
}

console.log(`完成，用时 ${((Date.now() - started) / 1000).toFixed(1)}s`);
