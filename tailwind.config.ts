import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0e1116",
        panel: "#161b22",
        edge: "#232b36",
      },
    },
  },
  plugins: [],
};

export default config;
