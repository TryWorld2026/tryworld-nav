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
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
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
        gradient: 'gradient 8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
