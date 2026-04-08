import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f2ea",
        ink: "#17231f",
        accent: "#0f766e",
        accentDark: "#115e59",
        gold: "#d8a13d",
        panel: "#fffdf8",
        line: "#d8d4ca",
        hero: "#fbf7ef"
      },
      boxShadow: {
        card: "0 16px 32px rgba(15, 23, 42, 0.08)",
        soft: "0 24px 70px rgba(23, 35, 31, 0.10)",
        glow: "0 18px 50px rgba(15, 118, 110, 0.22)"
      },
      fontFamily: {
        sans: [
          "Aptos",
          "Satoshi",
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
