#!/usr/bin/env node
/**
 * 生成 PWA 的三张位图图标 —— 写进 `public/assets/site/`。
 *
 * 为什么需要它们：Chrome 判定「可安装」（地址栏出现安装图标、能添加到主屏幕）
 * 要求 manifest 里至少有一张 192×192 与一张 512×512 的**位图**。原清单只有
 * `icon.svg`（`sizes: any`，Chrome 不算数）和一张声明成 256×256 的 PNG，
 * 所以添加到主屏幕的入口一直是灰的。
 *
 * 为什么母版用 `icon.svg` 而不是那张 PNG：`apple-touch-icon.png` 实际是
 * 180×180（不是注释里以为的 256）。180 → 512 是 2.84 倍放大，绿色笔画边缘
 * 会糊出一圈灰晕；`icon.svg` 是同一个标的矢量版（同一块 #F2EEE6 圆角底 +
 * 同一条 #24564E 笔画，64 单位 viewBox），按目标尺寸重新栅格化，512 下依旧
 * 锐利。PNG 只作为 SVG 缺失时的兜底，保证脚本在任何检出上都能跑。
 *
 * maskable 那张：Android 会把图标裁成圆形 / 水滴形 / 圆角方形，内容必须落在
 * 中心 80% 的安全区里，否则笔画会被切掉一圈。做法是把标缩到画布的 80% 居中，
 * 四周用骨白 #F2EEE6 铺满。**必须不透明** —— 透明边被遮罩后会露出桌面壁纸，
 * 看起来像图标破了个洞。
 *
 * 输出进 `public/assets/site/`：这个目录在 git 里（`public/assets/` 的其它
 * 子目录被 gitignore），因为浏览器与部分抓取器不喜欢跨域取站点图标。
 *
 *   node scripts/gen-pwa-icons.mjs
 *
 * 依赖 sharp（已在 node_modules；注意它目前不是 package.json 的显式依赖，
 * 若要进构建流水线需先 `npm i -D sharp`）。
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'public', 'assets', 'site');
const SVG = join(SITE, 'icon.svg');
const PNG = join(SITE, 'apple-touch-icon.png');

/** 品牌纸色。maskable 的安全边必须与 body 底同色，接缝才看不出来。 */
const PAPER = '#F2EEE6';

/** `icon.svg` 的 viewBox 边长。栅格化密度要按它反算。 */
const VIEWBOX = 64;

const TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

if (!existsSync(SVG) && !existsSync(PNG)) {
  console.error('找不到 public/assets/site/icon.svg 或 apple-touch-icon.png，无法生成图标');
  process.exit(1);
}

const svgBuffer = existsSync(SVG) ? readFileSync(SVG) : null;

/**
 * 把母版栅格化成边长 `size` 的 PNG buffer（透明圆角保留，与现有的
 * apple-touch-icon 一致）。
 */
async function raster(size) {
  if (svgBuffer) {
    // 关键在 `density`：librsvg 默认按 72dpi 渲染，64 单位的 viewBox 只会
    // 出 64px 的图，再 resize 到 512 就是「小位图放大」，等于白用矢量。
    // 按目标尺寸反算 dpi，让 SVG 直接渲染在目标分辨率上，笔画边缘才干净。
    const density = Math.max(72, Math.ceil((size / VIEWBOX) * 72));
    return sharp(svgBuffer, { density })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  // 兜底：位图母版（180×180）放大，边缘会软一点，但不会让脚本失败。
  return sharp(PNG)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * maskable：80% 内容 + 四边骨白。内层那圈透明圆角在纸色底上完全看不出接缝，
 * 因为 `icon.svg` 自己的底就是同一个 #F2EEE6。
 */
async function rasterMaskable(size, contentRatio = 0.8) {
  const inner = Math.round(size * contentRatio);
  const art = await raster(inner);
  return sharp({
    create: { width: size, height: size, channels: 4, background: PAPER },
  })
    .composite([{ input: art, gravity: 'center' }])
    // `flatten` 把透明像素压成纸色，`removeAlpha` 再把 alpha 通道整个去掉：
    // maskable 图标允许透明，但个别启动器会把带 alpha 通道的图标垫灰再裁，
    // 露出一圈灰边。两者都做，输出才是纯 RGB。
    .flatten({ background: PAPER })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

mkdirSync(SITE, { recursive: true });

const written = [];

for (const { file, size } of TARGETS) {
  const buf = await raster(size);
  const path = join(SITE, file);
  await sharp(buf).toFile(path);
  written.push({ file, size, bytes: buf.length });
}

const maskablePath = join(SITE, 'icon-maskable-512.png');
const maskableBuf = await rasterMaskable(512);
await sharp(maskableBuf).toFile(maskablePath);
written.push({ file: 'icon-maskable-512.png', size: 512, bytes: maskableBuf.length });

// 读回 metadata 而不是打印「我以为写了什么」：上一版 manifest 的尺寸声明
// （256 vs 实际 180）就是只在读文件时才会暴露的那类错误。
for (const { file } of written) {
  const meta = await sharp(join(SITE, file)).metadata();
  const bytes = readFileSync(join(SITE, file)).length;
  console.log(
    `${file.padEnd(24)} ${String(meta.width).padStart(4)}×${String(meta.height).padEnd(4)} ` +
      `${meta.format.padEnd(4)} alpha=${meta.hasAlpha ? 'yes' : 'no '} ` +
      `${(bytes / 1024).toFixed(1)} KB`,
  );
}

console.log(`\n写出 ${written.length} 张图标 → public/assets/site/`);
