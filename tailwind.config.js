/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17212B',      // sidebar, headings
        steel: '#4A5A6B',    // secondary text
        line: '#DCE1E6',     // borders
        canvas: '#F3F5F7',   // page background
        teal: { DEFAULT: '#0E6B6F', dark: '#0A5356', light: '#E3F1F1' }, // primary action
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
