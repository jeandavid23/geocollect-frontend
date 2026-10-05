/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          // vert forêt (feuille de cacaoyer), plus sobre que le vert Tailwind par défaut
          50:  '#f1f6f2',
          100: '#dfebe2',
          200: '#bfd7c5',
          300: '#93bb9e',
          400: '#5f9870',
          500: '#3d7b50',
          600: '#2c6741',
          700: '#235535',
          800: '#1d452c',
          900: '#183a25',
        },
        eudr: {
          green:  '#16a34a',
          orange: '#ea580c',
          red:    '#dc2626',
          blue:   '#2563eb',
        },
      },
      // angles sobres : les classes rounded-xl / rounded-2xl existantes deviennent plus discrètes
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.625rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
