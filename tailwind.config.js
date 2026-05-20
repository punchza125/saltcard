/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    'bg-brand-blue', 'bg-brand-light', 'bg-brand-pale', 'bg-brand-dark', 'bg-brand-navy', 'bg-brand-red',
    'text-brand-blue', 'text-brand-light', 'text-brand-pale', 'text-brand-dark', 'text-brand-navy',
    'border-brand-blue', 'border-brand-light',
    'hover:bg-brand-blue', 'hover:bg-brand-light',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:   '#1a52b3',
          light:  '#2e7ff0',
          pale:   '#e8f0fc',
          dark:   '#0d1b3e',
          navy:   '#0a1628',
          red:    '#e94560',
        }
      },
      fontFamily: {
        display: ['"Noto Sans Thai"', 'sans-serif'],
        body: ['"Noto Sans Thai"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
