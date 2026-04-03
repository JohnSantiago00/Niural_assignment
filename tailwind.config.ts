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
        canvas: "#f7f4ee",
        ink: "#1f2937",
        accent: "#0f766e",
        accentDark: "#115e59",
        panel: "#fffdf8",
        line: "#d6d3d1"
      },
      boxShadow: {
        card: "0 16px 32px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

