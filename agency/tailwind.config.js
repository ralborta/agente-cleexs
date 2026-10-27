/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens de Stitch (dark first). En tema claro se remapean vía CSS variables.
        bg: v('bg'), // #070b12
        surface: v('surface'), // #0f1725
        surface2: v('surface2'), // #0b1320
        line: v('line'), // #1b2537
        fg: v('fg'),
        muted: v('muted'),
        dim: v('dim'),
        'accent-cyan': v('cyan'), // #38bdf8
        'accent-teal': v('teal'), // #2dd4bf
        'accent-purple': v('purple'), // #a855f7
        'accent-amber': v('amber'), // #eab308
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
