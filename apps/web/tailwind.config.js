/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#635BFF',
          600: '#533AFD',
          700: '#432DE3',
        },
      },
      boxShadow: {
        'glass-card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        'glass-hover': '0 10px 25px -4px rgba(99, 91, 255, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.02)',
        'drawer': '-10px 0 40px -10px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
