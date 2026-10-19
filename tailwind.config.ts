import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,mdx}',
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  // The origin colours its category rows with a Tailwind tone class taken from
  // the category payload (`text-rose-500` and friends), so the class name is
  // assembled at runtime and Tailwind's content scanner can never see it. These
  // 88 classes are the whole space the harvested catalog can produce: 22 hues ×
  // 4 shades, which covers all 24 tones in `categories.json` plus the two the
  // origin's own sidebar hardcodes instead (`rose-500`, `slate-500`).
  safelist: [
    {
      pattern:
        /^text-(?:amber|blue|cyan|emerald|fuchsia|green|indigo|lime|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|yellow|gray|zinc|neutral)-(?:400|500|600|700)$/,
    },
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
        magicborder: 'hsl(var(--magicborder))',
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
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        // Both stacks resolve to the same brand faces: 试界 specifies Noto Sans SC
        // for Chinese body/heading text and Fraunces for the English point line.
        // `display` replaced the original `smiley` key (SmileySans is gone).
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        // Fraunces — the brand's English point line (italic serif).
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
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
