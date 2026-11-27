/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: "#8EF3CE",
        gold: "#8EF3CE",
        mauve: "#46645C",
        violet: "#164039",
        charcoal: "#24544B",
        deepBlack: "#164039",
        offWhite: "#F3F4F1",
      },
      fontFamily: {
        heading: ["DM Serif Display", "Georgia", "serif"],
        body: ["Amarna", "Arial", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(10, 43, 37, 0.14)",
        glow: "0 0 25px rgba(142, 243, 206, 0.22)",
        goldGlow: "0 0 20px rgba(142, 243, 206, 0.24)",
      },
    },
  },
  plugins: [],
}
