/** @type {import('tailwindcss').Config} */
export default {
  content: ['./admin/**/*.{html,js}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      }
    }
  },
  plugins: []
};
