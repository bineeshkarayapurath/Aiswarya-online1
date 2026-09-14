/** @type {import('tailwindcss').Config} */

// Colors come from the master white-label config so that changing a hex in
// src/config/clubConfig.js + a rebuild re-themes every utility class.
import { clubConfig } from './src/config/clubConfig';

const { primary, accent } = clubConfig.themeColors;
const slate = { 50: '#F8FAFC', 100: '#f1f5f9' };

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: { ...primary },
        gold: { DEFAULT: accent.DEFAULT, ...accent },
        slate: { ...slate },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '"Manrope"',
          '"Noto Sans Malayalam"',
          'system-ui',
          'sans-serif',
        ],
        malayalam: ['"Noto Sans Malayalam"', '"Manrope"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Manrope"', '"Noto Sans Malayalam"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};