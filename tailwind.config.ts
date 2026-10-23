import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#fbf7f2",
        sand: "#f1e8dc",
        champagne: "#d9bf9a",
        gold: { DEFAULT: "#b08a4e", dark: "#8a6a35" },
        cocoa: { DEFAULT: "#3b2a22", soft: "#6b564b" },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "Georgia", "Cambria", '"Times New Roman"', "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      boxShadow: { soft: "0 10px 40px -12px rgba(59,42,34,0.25)" },
    },
  },
  plugins: [],
};
export default config;
