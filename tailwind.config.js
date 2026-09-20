/** @type {import('tailwindcss').Config} */

// The palettes the app uses are driven by CSS variables (src/theme.css), so the whole
// UI can switch between dark and light without touching individual components.
// `<alpha-value>` keeps opacity modifiers such as bg-slate-900/60 working.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const themed = (name) =>
  Object.fromEntries(
    SHADES.map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`])
  );

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7c3aed",
          dark: "#5b21b6",
          light: "#a78bfa"
        },
        // page surfaces: bg-page, bg-page-deep, text-page
        page: {
          DEFAULT: "rgb(var(--page) / <alpha-value>)",
          deep: "rgb(var(--page-deep) / <alpha-value>)"
        },
        slate: themed("slate"),
        red: themed("red"),
        emerald: themed("emerald"),
        sky: themed("sky"),
        amber: themed("amber"),
        orange: themed("orange")
      },
      borderRadius: {
        '2xl': '1.25rem'
      }
    },
  },
  plugins: [],
}
