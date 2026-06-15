import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f5f7",
          100: "#e3e8ed",
          200: "#c5ced8",
          300: "#97a8b8",
          400: "#647989",
          500: "#3d5163",
          600: "#101f2e",
          700: "#0c1723",
          800: "#081018",
          900: "#050a10",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
