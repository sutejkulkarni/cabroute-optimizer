/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        brand: {
          50:  "#edfaf4",
          100: "#d4f3e4",
          200: "#ace6cb",
          300: "#74d2aa",
          400: "#3cb67f",
          500: "#1e9962",
          600: "#137a4d",
          700: "#106140",
          800: "#0f4d34",
          900: "#0d3f2b",
        },
        dark: {
          900: "#0a0f0d",
          800: "#111a15",
          700: "#182320",
          600: "#1f2e28",
          500: "#2a3d35",
        }
      },
    },
  },
  plugins: [],
}
