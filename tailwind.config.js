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
      keyframes: {
        kenburns: { '0%': { transform: 'scale(1.0) translate3d(0,0,0)' }, '100%': { transform: 'scale(1.09) translate3d(-1.5%,-1%,0)' } },
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        progress: { '0%': { width: '0%' }, '100%': { width: '100%' } },
        // pages : aucune transformation ne reste après l'animation (sinon les fenêtres « fixed » seraient décalées)
        'page-in': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        kenburns: 'kenburns 9s ease-out forwards',
        'fade-up': 'fade-up .7s cubic-bezier(.2,.7,.2,1) both',
        progress: 'progress linear forwards',
        'page-in': 'page-in .4s cubic-bezier(.2,.7,.2,1) backwards',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
