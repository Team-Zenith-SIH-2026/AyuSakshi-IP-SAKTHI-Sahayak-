/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ayur: {
          50: '#f0fdf4',
          100: '#e6f4ea',
          200: '#c2ebd9',
          300: '#a7d7c5',
          400: '#52c29c',
          500: '#3dbb8f',
          600: '#1e8a68',
          700: '#166e53',
          800: '#135440',
          900: '#0f2d24',
          950: '#081a15',
        },
        nature: {
          lightBg: '#F8FAF6',
          lightMint: '#E6F4EA',
          lightSage: '#A7D7C5',
          darkBg: '#0F2D24',
          darkSurface: '#12332A',
          darkCard: '#163D32',
          darkBorder: '#1F4F41',
          darkTeal: '#1E5B4B',
          emeraldAccent: '#3DBB8F',
        },
        darkbg: {
          900: '#0b1d17',
          950: '#071612',
          card: '#102821',
          border: '#1a3d33',
          glow: '#0f382d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
