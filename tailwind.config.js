/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        navy: {
          DEFAULT: '#0f2d5e',
          light: '#1a3f7a',
          dark:  '#09203f',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans Thai', 'IBM Plex Sans', 'sans-serif'],
        display: ['Sarabun', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px 0 rgba(15,45,94,0.10)',
        'card-hover': '0 8px 30px 0 rgba(15,45,94,0.18)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
