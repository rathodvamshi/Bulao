/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['PlusJakartaSans-Regular', 'sans-serif'],
        regular: ['PlusJakartaSans-Regular', 'sans-serif'],
        medium: ['PlusJakartaSans-Medium', 'sans-serif'],
        semibold: ['PlusJakartaSans-SemiBold', 'sans-serif'],
        bold: ['PlusJakartaSans-Bold', 'sans-serif'],
        devanagari: ['NotoSansDevanagari-Regular', 'sans-serif'],
        telugu: ['NotoSansTelugu-Regular', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
