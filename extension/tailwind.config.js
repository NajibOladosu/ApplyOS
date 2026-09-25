/** @type {import('tailwindcss').Config} */
/*
 * Token-driven, matching tailwind.config.ts in the web app.
 *
 * In 1.0.0 these colours were literals (#0A0A0A, #1A1A1A) with the dark theme
 * baked in, so the popup had no light mode at all. Reading from the CSS
 * variables in globals.css gives both themes from one set of class names.
 */
module.exports = {
    darkMode: ['class'],
    content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
    theme: {
        extend: {
            /*
             * Tokens are referenced as rgb(var(--x) / <alpha-value>), and the
             * variables in globals.css hold space-separated channels
             * (e.g. --primary: 24 187 112).
             *
             * This is required, not stylistic: Tailwind v3 cannot compose an
             * alpha modifier onto a variable holding a hex string, so with
             * `primary: 'var(--primary)'` the class `bg-primary/10` generated no
             * CSS at all — silently, with no build warning. Every tinted pill,
             * hairline border and translucent surface in the popup depended on
             * those utilities, so they rendered as nothing.
             */
            colors: {
                border: 'rgb(var(--border) / <alpha-value>)',
                input: 'rgb(var(--input) / <alpha-value>)',
                ring: 'rgb(var(--ring) / <alpha-value>)',
                background: 'rgb(var(--background) / <alpha-value>)',
                foreground: 'rgb(var(--foreground) / <alpha-value>)',
                primary: {
                    DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
                    foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
                    strong: 'rgb(var(--primary-strong) / <alpha-value>)',
                    neon: 'rgb(var(--primary-neon) / <alpha-value>)',
                    hover: 'rgb(var(--primary) / <alpha-value>)',
                },
                secondary: {
                    DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
                    foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
                },
                destructive: {
                    DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
                    foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
                },
                muted: {
                    DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
                    foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
                    foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
                },
                popover: {
                    DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
                    foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
                },
                card: {
                    DEFAULT: 'rgb(var(--card) / <alpha-value>)',
                    foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: {
                sans: ['Manrope', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk', 'Manrope', 'system-ui', 'sans-serif'],
            },
            keyframes: {
                'fade-in': {
                    from: { opacity: '0', transform: 'translateY(4px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 160ms ease-out',
                'slide-up': 'slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            },
        },
    },
    plugins: [],
}
