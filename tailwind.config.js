import colors from 'tailwindcss/colors'

// vert forêt (feuille de cacaoyer) : couleur de la marque
const FOREST = {
  50: '#f1f6f2', 100: '#dfebe2', 200: '#bfd7c5', 300: '#93bb9e', 400: '#5f9870',
  500: '#3d7b50', 600: '#2c6741', 700: '#235535', 800: '#1d452c', 900: '#183a25', 950: '#10281a',
}
// « attention » (à vérifier, à surveiller) : une seule gamme, texte foncé lisible sur fond clair
const WARNING = {
  50: '#fef8ec', 100: '#fdf0d5', 200: '#fadfa6', 300: '#f5c56b', 400: '#eda43f',
  500: '#e08a1e', 600: '#c26d10', 700: '#9a520c', 800: '#7c3a06', 900: '#5f2c05', 950: '#3a1a02',
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: FOREST,
        // ── Charte (voir l'aperçu « GeoCollect — aperçu du design ») ──────────────────────────────
        // Un seul vert : le vert vif de Tailwind (green, emerald) prend les teintes du vert forêt,
        // ce qui unifie d'un coup les ~130 usages restants.
        green: FOREST,
        emerald: FOREST,
        // Une seule couleur « attention » : orange, ambre et jaune deviennent la même gamme
        amber: WARNING,
        orange: WARNING,
        yellow: WARNING,
        // Gris : le 400 (trop pâle pour du texte, 2,5:1) devient lisible (4,8:1)
        gray: { ...colors.gray, 400: '#6b7280', 500: '#5b6472' },
        // Couleurs par sens (à préférer dans le code neuf) et niveaux de risque, identiques partout
        success: { bg: '#e8f3ec', text: '#1d452c', solid: '#2c6741', ondark: '#8fe0a8' },   // ondark : sur le menu vert foncé
        warning: { bg: '#fdf0d5', text: '#7c3a06', solid: '#e08a1e' },
        danger: { bg: '#fde4e2', text: '#7f1d1d', solid: '#b42318' },
        info: { bg: '#e2ecfb', text: '#1e3a8a', solid: '#1d4ed8' },
        risk: { faible: '#2c6741', verifier: '#e08a1e', eleve: '#9b1c1c' },
        eudr: {
          green:  '#2c6741',
          orange: '#e08a1e',
          red:    '#b42318',
          blue:   '#1d4ed8',
        },
      },
      // Trois arrondis : 6 px (boutons, champs, petits éléments), 10 px (cartes, fenêtres), pastille (full)
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.375rem',
        md: '0.375rem',
        lg: '0.375rem',
        xl: '0.625rem',
        '2xl': '0.625rem',
        '3xl': '0.625rem',
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
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
