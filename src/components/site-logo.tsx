/**
 * 试界 TryWorld 主标。
 *
 * 唯一几何来源是品牌包 `assets/identity/mark.json`，正式导出在
 * `assets/logos/tryworld-signature-{green,ink,light}.svg`。路径数据照抄导出
 * 文件，**不要描摹或重新生成**——品牌规范明确禁止用图像模型重建主标。
 *
 * 主标是「小写 t / w 连写」的单条圆头笔画。viewBox 192×116（宽高比 1.655），
 * 所以它**不是方的**：放进品牌位时必须给宽度 + `h-auto`，塞进 `h-8 w-8`
 * 会被压扁。品牌规范要求图形周围至少留一笔宽度的空白，独立图形宽度 ≥32px。
 *
 * `stroke="currentColor"` 让调用方用 `text-*` 控制颜色：骨白底上用深绿或石墨，
 * 深绿底上用骨白。
 */
export function SiteLogo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 192 116"
      role="img"
      aria-label={title ?? '试界 TryWorld'}
      className={className}
      focusable="false"
    >
      <path
        d="M49 17C43 34 39 56 42 73C44 88 54 98 67 99M17 40C35 34 52 28 66 35C83 44 77 82 92 86C101 89 110 64 117 63C123 64 126 85 139 86C154 88 169 55 174 43"
        fill="none"
        stroke="currentColor"
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
