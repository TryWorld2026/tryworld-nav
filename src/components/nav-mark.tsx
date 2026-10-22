/**
 * 试界导航的独立标志 —— **子品牌图形**，不是母品牌主标。
 *
 * ## 为什么需要它
 *
 * 母品牌主标（小写 t / w 连写，几何唯一来源是品牌包的 `mark.json`）已经用在
 * 作者的个人网站上。导航站需要与它区分开，但按试界品牌规范《标志与子品牌》：
 *
 *   > 主标直接复用；子品牌允许独立图形与联合署名……保持简洁、单色成立、
 *   > 轮廓清楚、圆润转折；不强迫所有产品都变成 tw 字母变体。
 *
 * 所以这里是一个**独立的罗盘图形**，不是 tw 的变体，也不描摹母标。
 * 母标的唯一几何仍住在 `mark.json`，本文件不碰它。
 *
 * ## 为什么是罗盘
 *
 * 「导航」最直接的语义就是「指向」。候选里排除掉的方案与理由：
 *   - 斜指针（45°）在 16px 下会读成「禁止」符号（圆圈 + 斜杠）；
 *   - 单向朝上的针读起来像「播放」或「上传」，而不是罗盘；
 *   - 四角星（sparkle）是 AI 产品的通用装饰，没有「导航」语义；
 *   - 无环的纯菱形在 16px 下只剩一条竖缝。
 *
 * 最终形态：**圆环 + 纵向长菱形针**。纵向布局避开「禁止」误读，圆环给出
 * 「罗盘表盘」的框，菱形针是表盘上最经典的那根指针。
 *
 * ## 尺寸与线宽（实测过，不要随手改）
 *
 * 在 128 / 64 / 32 / 16px 与深绿底反白下逐个渲染对比过（`work/logo-explore/`）：
 *   - 主图形 `strokeWidth 4.5` 在 32px 起清楚可辨，16px 偏细；
 *   - 所以另给一个**16px 专用加粗版**（`strokeWidth 6.5` + 针更宽），
 *     对应品牌规范「独立图形宽度至少 32px，更小使用专门加粗的 favicon」。
 *
 * 品牌规范要求图形周围至少留一笔宽度的空白，所以圆环半径取 19（viewBox 48），
 * 四边各留 5 个单位 ≈ 一笔宽。
 *
 * `stroke="currentColor"` / `fill="currentColor"` 让调用方用 `text-*` 控色：
 * 骨白底上用墨或深绿，深绿底上用骨白。
 */

/** 主图形：圆环 + 纵向长菱形针。用于 ≥32px 的任何位置。 */
export function NavMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title ?? '试界导航'}
      className={className}
      focusable="false"
    >
      <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth={4.5} fill="none" />
      <path d="M24 5.5 L31 24 L24 42.5 L17 24 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * 16px 专用加粗版 —— 只给 favicon 与浏览器标签这种最小尺寸用。
 *
 * 环与针都加粗（4.5 → 6.5），针也放宽（±7 → ±8），否则 16px 下环会断成虚线、
 * 针会缩成一个点。**不要**在 ≥32px 的位置用它：那时候它会显得笨重。
 */
export function NavMarkBold({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title ?? '试界导航'}
      className={className}
      focusable="false"
    >
      <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth={6.5} fill="none" />
      <path d="M24 7 L32 24 L24 41 L16 24 Z" fill="currentColor" />
    </svg>
  );
}
