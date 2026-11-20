import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#111110",
          panel: "#1B1B19",
          border: "#2A2A27",
          text: "#F5F5F4",
          muted: "#A8A29E",
        },
        brand: {
          amber: "#F59E0B",
          fatal: "#EF4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
