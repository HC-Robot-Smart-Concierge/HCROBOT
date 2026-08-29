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
          canvas: '#F5F2EB',
          sidebar: '#EDE9E0',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          cardMuted: '#F9F8F5',
          border: '#E3DFD5',
          borderLight: '#EFECE6',
          muted: '#8C857B',
          primary: '#1A1917',
          dark: '#141413',
          inverse: '#262626',
          textInverse: '#F2EFE9',
          red: {
            DEFAULT: '#DC2626',
            light: '#FEE2E2',
            gradient: '#F87171',
            dark: '#991B1B',
          },
          emerald: {
            DEFAULT: '#059669',
            light: '#D1FAE5',
          },
          sky: {
            DEFAULT: '#0284C7',
            light: '#E0F2FE',
          },
          amber: {
            DEFAULT: '#D97706',
            light: '#FEF3C7',
          }
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'aurora': '0 2px 10px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)',
        'aurora-lg': '0 10px 25px -4px rgba(0, 0, 0, 0.07), 0 4px 10px -2px rgba(0, 0, 0, 0.03)',
        'aurora-glow': '0 0 20px rgba(220, 38, 38, 0.25)',
      }
    },
  },
  plugins: [],
};
