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
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
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
      typography: {
        DEFAULT: {
          css: {
            color: "#EDEDED",
            a: {
              color: "#00FF88",
              "&:hover": {
                color: "#00FF88",
              },
            },
            strong: {
              color: "#EDEDED",
              fontWeight: "700",
            },
            em: {
              color: "#EDEDED",
            },
            h1: {
              color: "#EDEDED",
              fontWeight: "700",
            },
            h2: {
              color: "#EDEDED",
              fontWeight: "700",
            },
            h3: {
              color: "#EDEDED",
              fontWeight: "700",
            },
            h4: {
              color: "#EDEDED",
              fontWeight: "700",
            },
            h5: {
              color: "#EDEDED",
              fontWeight: "700",
            },
            h6: {
              color: "#EDEDED",
              fontWeight: "700",
            },
            ul: {
              color: "#EDEDED",
            },
            ol: {
              color: "#EDEDED",
            },
            li: {
              color: "#EDEDED",
            },
            blockquote: {
              color: "#EDEDED",
              borderLeftColor: "#00FF88",
              fontStyle: "italic",
            },
            code: {
              color: "#00FF88",
              backgroundColor: "#1A1A1A",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              fontFamily: "monospace",
            },
            "code::before": {
              content: '""',
            },
            "code::after": {
              content: '""',
            },
            pre: {
              backgroundColor: "#1A1A1A",
              color: "#EDEDED",
              border: "1px solid #2A2A2A",
              borderRadius: "0.5rem",
            },
            "pre code": {
              backgroundColor: "transparent",
              color: "#EDEDED",
              padding: "0",
            },
            hr: {
              borderColor: "#2A2A2A",
            },
            "ul > li::marker": {
              color: "#00FF88",
            },
            "ol > li::marker": {
              color: "#00FF88",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}

export default config
