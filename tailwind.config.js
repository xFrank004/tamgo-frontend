/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        asphalt: { DEFAULT: '#14213D', light: '#233152', dark: '#0D1628' },
        route: { DEFAULT: '#1B7A43', dark: '#125430', light: '#DCEFE1' },
        ink: { DEFAULT: '#1E4C8C', dark: '#153A6D', light: '#DDE7F5' },
        paper: { DEFAULT: '#EDEFE6', card: '#FBFBF7', line: '#E2E4D8' },
        ochre: { DEFAULT: '#D68C24', light: '#FBEBD1' },
        rust: { DEFAULT: '#B23A24', light: '#F7DFD8' },
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
