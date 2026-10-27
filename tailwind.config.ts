import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,mdx}',
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  // ── 分类色：4 个品牌色调，不再放行 22 个 Tailwind 色相 ────────────────
  //
  // 2026-10-27 之前这里是一条正则 safelist，放行 **22 色相 × 4 明度 = 88 个**
  // `text-*` 类，注释还自认「覆盖 categories.json 里的全部 24 个色调」。
  // 实测那份数据的 26 条 `tailwind` 去重后是 **15 个色相族 × 3 个明度档**，
  // 9 组共用色相只能靠 `red-500` / `red-700` 一档之差区分 —— 20px 图标上
  // 肉眼分不出，一屏 26 个彩色小圆点，是全站最强的「AI 涂色感」来源。
  // 放行表里还躺着 `purple` / `violet`，与品牌「禁紫色」直接冲突：门开着，
  // 加一个分类就会静默生效。
  //
  // 现在分类色收成品牌 token 里的 4 个色，与首页 `page.tsx` 的
  // `CATEGORY_GROUPS` 四组同构 —— **颜色开始承载信息（属于哪一组），
  // 而不只是装饰**。四个色全部来自 `globals.css` 顶部注释的品牌 token 清单，
  // 没有引入新颜色。`categories.json` 的 `color`（RGB 三元组）由
  // `work/_design-audit/p2-recolor.mjs` 一并改写，两处必须同步。
  //
  // 类名仍是运行时拼的（`${c.tailwind}`），扫描器看不见，所以还要 safelist —
  // 但只剩 4 条，且每条都是真用到的。
  safelist: [
    'text-category-create',
    'text-category-research',
    'text-category-work',
    'text-category-business',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Site-chrome colours, mapped to the 试界 palette. Plain hex rather than
        // HSL channel triplets, because these are used with opacity modifiers
        // (`text-foreground/80`), which only works when Tailwind can split them.
        //
        // The keys keep the original names (`muted`/`gray`/`dark`/`accent`) so the
        // ~30 call sites across the app need no edit; only the values changed.
        gongke: {
          muted: '#616A63', // brand muted — secondary text
          gray: '#D3D5CB', // brand line — hairlines and chip borders
          dark: '#1B2523', // brand ink — body text and the mark on light ground
          accent: '#24564E', // brand green — links, rings, primary actions
          // ── 2026-10-27 补的四档 ─────────────────────────────────────
          // 这四个值早就在 `src/` 里用着，但都是**方括号硬编码**：
          // `text-[#F2EEE6]` 77 处、`text-[#F2A07F]` 10 处、`bg-[#1B2523]` 一批、
          // `bg-[#253230]` 2 处。硬编码的问题是它绕过 token：改品牌色时这些
          // 地方不会跟着变，而它们出现的正是「墨底上的文字」这种最显眼的位置。
          paper: '#F2EEE6', // 骨白 —— 墨底上的正文与实心主按钮的文字
          onInk: '#F2A07F', // 品牌橙提亮后的暖砂色 —— 只用在 .ink-band 里做眉标/图标
          darkHover: '#253230', // 墨的 hover 档（dark 提亮 4%），实心按钮用
          earth: '#B54826', // 陶土 smallAccent —— 付费档、部分分类
          orange: '#F2693C', // 品牌橙 —— 需要「暖色强调」时用它
        },
        // 分类色：4 个品牌色调，与首页 `CATEGORY_GROUPS` 四组一一对应。
        // 见下方 `safelist` 上方注释 —— 这是把 15 个色相族收成 4 个的结果。
        category: {
          create: '#F2693C', // 品牌橙 —— 创作与表达
          research: '#24564E', // 品牌绿 —— 检索与研究
          work: '#1B2523', // 品牌墨 —— 办公与效率（中性，占 10/26）
          business: '#B54826', // 品牌 smallAccent 陶土 —— 生意与专业
        },
      },
      // ── 字号阶梯：14 档，覆盖 11–72px，无半像素档 ──────────────────────
      //
      // 2026-10-27 之前源码里同时存在 **28 个字号档**（10 / 11 / 11.5 / 12 /
      // 12.5 / 13 / 13.5 / 14 / 14.5 / 15 / 16 / 17 / 18 / 19 / 20 / 22 / 24 /
      // 26 / 28 / 30 / 34 / 36 / 40 / 42 / 48 / 56 / 64 / 72），其中 11.5 与
      // 12.5 分别出现 14 / 46 次 —— 半像素档肉眼分不出，只说明字号是逐处
      // 手写的。10–16px 这一窄带里挤了 10 档，承载全站 95% 的文本节点。
      //
      // 现在收成 14 档，10–16 带只剩 3 档（11 / 12 / 14）。**取值刻意保住
      // Tailwind 的 xs=12 / sm=14 / base=16 / lg=18 / xl=20 / 2xl=24 / 3xl=30 /
      // 4xl=36**：`text-sm` 全站 122 次、`text-xs` 113 次，把 14 改成 13 会让
      // 整站正文再小一档，而这正是审计报告里「小字是常态、正常字号是例外」
      // 要修的方向 —— 收档位不该顺手把正文改小。被牺牲的只有半像素档与孤档
      // （10→11、11.5→11、12.5→12、13→14、13.5→14、14.5→14、15→16、
      // 17→18、19→20、22→24、26→30、28→30、34→36、42→40）。
      //
      // 40 是单独一档（不是 42 也不是 48）：资讯报头 h1 在 md 档就是 40px，
      // 往上 48 给 1800px 以上的页面 h1。中间不能省掉 40，否则 1440 下
      // 资讯头条会从 40 跳到 48 或掉到 36。
      //
      // **不要再用 `text-[Npx]`**。需要新档先在这里加，并同步更新
      // `work/_design-audit/p1-fontscale.mjs` 的迁移表。
      fontSize: {
        '2xs': '11px', // 徽章、计数、kbd
        xs: '12px', // 卡片元信息、chip
        sm: '14px', // 正文主力（Tailwind 默认，勿改）
        base: '16px', // 长正文（Tailwind 默认，勿改）
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px', // 区块 h2
        '4xl': '36px', // 页面 h1（桌面）
        '5xl': '40px', // 资讯报头 h1
        '6xl': '48px', // 页面 h1（≥1800）
        '7xl': '56px', // 首页 h1（桌面）
        '8xl': '64px',
        '9xl': '72px',
      },
      // ── 行高阶梯：4 档 ────────────────────────────────────────────────
      //
      // 原先实测渲染出 **18 种行高比**（1.00 / 1.11 / 1.15 / 1.20 / 1.22 /
      // 1.25 / 1.33 / 1.38 / 1.40 / 1.43 / 1.50 / 1.54 / 1.56 / 1.60 /
      // 1.63 / 1.75 / 1.85 / 2.00），同一页里能同时出现 5 种。其中 1.00
      // 出现 497 次是 `leading-none`（图标行、单行数字），属于合理用法。
      //
      // 现在收成 4 档语义值，并把 Tailwind 默认的 1.25 / 1.375 / 1.625 / 2
      // 全部覆盖掉 —— 覆盖是为了让「tight」在整站只有一个含义，否则
      // `leading-tight` 在不同元素上会算出 1.25 与 1.2 两个值。
      lineHeight: {
        none: '1',
        tight: '1.2', // 大标题、单行数字
        snug: '1.4', // 卡片标题、chip 多行
        normal: '1.5', // 短标签
        relaxed: '1.65', // 正文
        loose: '1.85', // 长文（关于/隐私/日报详情）
      },
      // ── 圆角阶梯：4 / 6 / 8 / 12 / 16 + full，全部显式进 token ──────────
      //
      // 原先源码里 9 个像素值并存（2 / 3 / 4 / 5 / 6 / 8 / 12 / 16 / 9999），
      // 其中 `rounded-[2px]` / `[3px]` / `[5px]` 三档是逐处手写的孤值。
      // 更关键的是 **卡片主力圆角 `rounded-xl`(12px) 与 `rounded-2xl`(16px)
      // 走的是 Tailwind 默认值、不在 token 里** —— 改 `--radius` 时全站
      // 卡片纹丝不动，token 形同虚设。
      //
      // 现在把 4/6/8/12/16 五档全部写进 config（`xl` / `2xl` 不再是默认值），
      // 三处孤值已并入 `sm`(4px)。为什么没进一步压成 3 档：`md`(6px) 用在
      // 20–24px 高的 chip 上，`lg`(8px) 用在 44px 图标底上，合并任何一侧都会
      // 让 chip 变药丸或让图标底变方角 —— 这两个语义确实需要两个值。
      //
      // **不要再用 `rounded-[Npx]`**。新档位先在这里加。
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      // ── 字体族：其实只有一个族 ──────────────────────────────────────────
      //
      // 2026-10-27 之前这里的三个 key 指向三条 CSS 变量，而前两条
      // （`--font-inter` / `--font-display`）的**值逐字相同**，第三条
      // （`--font-serif` → Georgia / Songti SC）全站 0 处调用。也就是说
      // `font-sans` 与 `font-display` 这两个 class 在浏览器里从来没有区别，
      // 「正文一个族、标题一个族」只是配置看上去像。
      //
      // 现在三条变量合成一条 `--font-sans`（见 `globals.css`）。`display`
      // key 保留，因为 `font-display` 有 156 个调用点 —— 它现在的含义是
      // 「标题用的那个族」，只是恰好与正文同族；将来真要给标题换族，改这里
      // 一行即可。`serif` key 直接删掉：没有调用点，留着只会让人以为能写。
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      screens: {
        '4xl': '1800px',
        '5xl': '2100px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // 只动 opacity，不动 transform。
        //
        // 为什么不用 transform：CSS 层叠里**动画声明优先于普通作者声明**
        // （CSS Cascading 3 §6.4.4 的来源顺序：animation 在 author normal 之上）。
        // 而 `animate-fade-in` 带了 `fill-mode: both`，动画结束后 `to` 帧的
        // `transform: none` 会**一直生效**——于是同元素上的 Tailwind 位移工具类
        // （`transform: translate(var(--tw-translate-x), …)`）被整个抹掉。
        // 2026-10-19 实测：命令面板的 `-translate-x-1/2` 就是这样被吃掉的，
        // 面板左缘停在视口中线（390px 屏上 left=195），右侧 163.8px（42%）
        // 悬在屏幕外，关闭按钮完全点不到。
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        // 面板用这一条：位移走**独立的 translate 属性**而不是 transform。
        // translate / rotate / scale 是 CSS 的独立变换属性，在 transform **之前**
        // 合成，所以和 Tailwind 的 transform 位移互不干扰，动画结束后也不会
        // 把居中效果抹掉。
        //
        // 老浏览器不支持 `translate` 属性时，退化成「只淡入不位移」——
        // 面板依然居中（transform 没被动过），比现在整块跑出屏幕好得多。
        //
        // 注意：这条**不能**用在全屏遮罩上。遮罩是 `fixed inset-0`，再往下
        // 位移 4px 会在屏幕顶端留一条 4px 的缝，所以遮罩用上面的纯 opacity 版。
        'rise-in': {
          from: { opacity: '0', translate: '0 4px' },
          to: { opacity: '1', translate: '0 0' },
        },
        // The sweep behind the 精选AI利器集合 headline. The origin animates
        // background-position by `--bg-size`, which the element sets inline to
        // 300%, so the gradient travels one full background width and stops.
        gradient: {
          to: { 'background-position': 'var(--bg-size) 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.25s ease-out both',
        'rise-in': 'rise-in 0.25s ease-out both',
        gradient: 'gradient 8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
