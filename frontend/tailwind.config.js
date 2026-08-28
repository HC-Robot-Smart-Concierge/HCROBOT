/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurora: {
          canvas: '#F2EFE9',
          inverse: '#262626',
          surface: '#E9E5DC',
          border: '#BFBFBD',
          muted: '#D8D4CB',
          primary: '#262626',
          textInverse: '#F2EFE9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.75rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
