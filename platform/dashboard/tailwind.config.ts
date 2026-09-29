import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b0ff",
          500: "#338dff",
          600: "#1a6df5",
          700: "#1357e1",
          800: "#1646b6",
          900: "#183d8f",
          950: "#132757",
        },
      },
    },
  },
  plugins: [],
};

export default config;
