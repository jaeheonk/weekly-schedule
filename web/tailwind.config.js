/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        category: {
          study: '#3878F5',
          academy: '#8C52EB',
          music: '#F38029',
          sports: '#29B873',
          routine: '#E65C8C',
          free: '#1FB0C2',
        }
      }
    },
  },
  plugins: [],
}
