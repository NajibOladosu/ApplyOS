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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
            color: "hsl(var(--foreground))",
            a: {
              color: "hsl(var(--primary))",
              "&:hover": {
                color: "hsl(var(--primary))",
              },
            },
            strong: {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
            },
            em: {
              color: "hsl(var(--foreground))",
            },
            h1: {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
            },
            h2: {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
            },
            h3: {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
            },
            h4: {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
            },
            h5: {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
            },
            h6: {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
            },
            ul: {
              color: "hsl(var(--foreground))",
            },
            ol: {
              color: "hsl(var(--foreground))",
            },
            li: {
              color: "hsl(var(--foreground))",
            },
            blockquote: {
              color: "hsl(var(--foreground))",
              borderLeftColor: "hsl(var(--primary))",
              fontStyle: "italic",
            },
            code: {
              color: "hsl(var(--primary))",
              backgroundColor: "hsl(var(--secondary))",
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
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            },
            "pre code": {
              backgroundColor: "transparent",
              color: "hsl(var(--foreground))",
              padding: "0",
            },
            hr: {
              borderColor: "hsl(var(--border))",
            },
            "ul > li::marker": {
              color: "hsl(var(--primary))",
            },
            "ol > li::marker": {
              color: "hsl(var(--primary))",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}

export default config
