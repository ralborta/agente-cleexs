import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        hub: {
          bg: '#0F172A',
          card: '#1E293B',
          border: '#334155',
          muted: '#94A3B8',
          text: '#F8FAFC',
        },
        cleexs: {
          blue: '#2563EB',
          'blue-dark': '#1D4ED8',
          orange: '#F97316',
          violet: '#7C3AED',
        },
      },
      boxShadow: {
        hub: '0 0 0 1px rgba(51, 65, 85, 0.8), 0 12px 40px rgba(15, 23, 42, 0.45)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
