/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral "ink" scale — the workbench surface
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d4d9e2",
          300: "#aab3c4",
          400: "#7c889f",
          500: "#586581",
          600: "#454f68",
          700: "#374055",
          800: "#252c3c",
          900: "#161b27",
          950: "#0d111b",
        },
        // Primary action — a deep "dispatch blue", not generic bootstrap blue
        brand: {
          50: "#eef3ff",
          100: "#dae4ff",
          200: "#bccfff",
          300: "#8eaeff",
          400: "#5982ff",
          500: "#335bf5",
          600: "#1d3fe0",
          700: "#1730b8",
          800: "#192c94",
          900: "#1a2b75",
        },
      },
      // Order-status semantic tokens (drive row colors + badges)
      // urgent/open=red, closed=green, tomorrow=amber, archived=gray, hold=violet
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        // Monospace for the data that gets scanned/read: order #, UPC, qty
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { xl2: "1rem" },
      boxShadow: {
        card: "0 1px 2px rgba(13,17,27,.06), 0 1px 3px rgba(13,17,27,.10)",
        pop: "0 10px 30px -10px rgba(13,17,27,.35)",
      },
    },
  },
  plugins: [],
};
