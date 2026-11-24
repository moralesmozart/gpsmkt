/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#1B2A3A', soft: '#4A5A6C', mute: '#5F6E80' },
        mata: { 50: '#E9F8EF', 100: '#CDEFDB', 300: '#6FD39A', 500: '#12A150', 600: '#0A7F3E', 700: '#086B34' },
        ipe: { 50: '#FFF8DB', 100: '#FFEFA8', 300: '#FFD84D', 400: '#FFC928', 500: '#F5B400', 700: '#8A6400' },
        mar: { 50: '#E8F1FF', 100: '#CFE1FF', 300: '#7FB0FF', 500: '#2F6BFF', 600: '#1F55D8', 700: '#173F9E' },
        coral: { 100: '#FFE1DA', 400: '#FF7A5C', 500: '#F25C3B' },
        uva: { 100: '#EEE5FF', 400: '#9B7BFF', 500: '#7C5CFF', 600: '#6A48F0' },
        areia: { 50: '#FFFCF5', 100: '#FBF5E8', 200: '#F3EAD6' },
      },
      boxShadow: {
        pop: '0 4px 0 0 rgba(27,42,58,0.12), 0 10px 24px -8px rgba(27,42,58,0.18)',
        card: '0 1px 2px rgba(27,42,58,.06), 0 8px 24px -12px rgba(27,42,58,.18)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}
