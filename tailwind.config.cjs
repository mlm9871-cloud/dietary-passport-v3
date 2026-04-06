/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A7A5E',
        'primary-light': '#F0FAF7',
        danger: '#DC2626',
        warning: '#D97706',
        safe: '#16A34A',
      },
    },
  },
  plugins: [],
}