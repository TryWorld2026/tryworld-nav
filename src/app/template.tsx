/**
 * 路由切换的页面入场。
 *
 * App Router 的 `template.tsx` 与 `layout.tsx` 的区别是：模板在**每次导航**
 * 时重新挂载，所以挂在它上面的 CSS 动画每次切页都会重播一次，而不会在
 * 客户端导航时被 React 复用掉。这正是「APP 感」里最廉价也最有效的一环 ——
 * 页面不是硬切，而是轻轻上浮 6px 淡入。
 *
 * 只有 340ms、位移 6px：再长再大就会让「返回」显得迟钝。所有动效统一走
 * `globals.css` 的 `prefers-reduced-motion` 降级（全局规则会把时长压到
 * 0.01ms），所以这里不需要再判断一次。
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
