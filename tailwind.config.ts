/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F5F0E8",
        charcoal: "#2D2D2D",
        terracotta: {
          DEFAULT: "#E8865A",
          dark: "#C05E33",
          deeper: "#9C4A26",
          soft: "#FBE9DD",
        },
      },
      fontFamily: {
        heading: ["Georgia", "'Times New Roman'", "serif"],
        body: ["Calibri", "'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: { xl2: "1rem" },
    },
  },
  plugins: [],
};
