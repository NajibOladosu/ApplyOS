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
          "0%, 100%": { boxShadow: "0 0 20px rgba(24, 187, 112, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(24, 187, 112, 0.5)" },
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
            color: "var(--foreground)",
            a: {
              color: "var(--primary)",
              "&:hover": {
                color: "var(--primary)",
              },
            },
            strong: {
              color: "var(--foreground)",
              fontWeight: "700",
            },
            em: {
              color: "var(--foreground)",
            },
            h1: {
              color: "var(--foreground)",
              fontWeight: "700",
            },
            h2: {
              color: "var(--foreground)",
              fontWeight: "700",
            },
            h3: {
              color: "var(--foreground)",
              fontWeight: "700",
            },
            h4: {
              color: "var(--foreground)",
              fontWeight: "700",
            },
            h5: {
              color: "var(--foreground)",
              fontWeight: "700",
            },
            h6: {
              color: "var(--foreground)",
              fontWeight: "700",
            },
            ul: {
              color: "var(--foreground)",
            },
            ol: {
              color: "var(--foreground)",
            },
            li: {
              color: "var(--foreground)",
            },
            blockquote: {
              color: "var(--muted-foreground)",
              borderLeftColor: "var(--primary)",
              fontStyle: "italic",
            },
            code: {
              color: "var(--primary)",
              backgroundColor: "var(--muted)",
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
              backgroundColor: "var(--secondary)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
            },
            "pre code": {
              backgroundColor: "transparent",
              color: "inherit",
              padding: "0",
            },
            hr: {
              borderColor: "var(--border)",
            },
            "ul > li::marker": {
              color: "var(--primary)",
            },
            "ol > li::marker": {
              color: "var(--primary)",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}

export default config
