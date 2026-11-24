/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: "#BFCFC1",
        gold: "#E7CA65",
        mauve: "#887984",
        violet: "#8050ED",
        charcoal: "#39333B",
        deepBlack: "#080808",
        offWhite: "#F5F4EF",
      },
      fontFamily: {
        heading: ["Cinzel", "serif"],
        body: ["Fauna One", "serif"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 25px rgba(128, 80, 237, 0.35)",
        goldGlow: "0 0 20px rgba(231, 202, 101, 0.3)",
      },
    },
  },
  plugins: [],
}
