/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './context/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
    './services/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './utils/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        lootx: {
          canvas: '#13151D',
          surface: '#181C28',
          elevated: '#202431',
          line: '#2D303D',
          text: '#F6F4F9',
          muted: '#7D8091',
          red: '#FF4D55',
          orange: '#FF8D4D',
          green: '#2ABD69',
          blue: '#02C5FF',
        },
        brand: {
          dark: '#0f172a',
          blue: '#205DD7',
          green: '#22c55e',
          bg: '#0b0e14',
          card: '#151a23',
          accent: '#2f75ff',
        },
      },
    },
  },
  safelist: [],
};
