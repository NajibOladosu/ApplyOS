import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "#1A1A1A",
        input: "#1A1A1A",
        ring: "#00FF88",
        background: "#0A0A0A",
        foreground: "#EDEDED",
        primary: {
          DEFAULT: "#00FF88",
          foreground: "#0A0A0A",
        },
        secondary: {
          DEFAULT: "#101010",
          foreground: "#B5B5B5",
        },
        destructive: {
          DEFAULT: "#FF4444",
          foreground: "#EDEDED",
        },
        muted: {
          DEFAULT: "#101010",
          foreground: "#B5B5B5",
        },
        accent: {
          DEFAULT: "#00FF88",
          foreground: "#0A0A0A",
        },
        popover: {
          DEFAULT: "#101010",
          foreground: "#EDEDED",
        },
        card: {
          DEFAULT: "#101010",
          foreground: "#EDEDED",
        },
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 255, 136, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(0, 255, 136, 0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow": "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
