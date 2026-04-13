import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fintech: {
          bg: "#FFFFFF",
          card: "#F7F7F7",
          brand: "#C45000",
          text: "#1A1A1A",
          muted: "#6B6B6B",
          gain: "#007A4C",
          loss: "#C0392B",
          border: "#E8E8E8",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        btn: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
