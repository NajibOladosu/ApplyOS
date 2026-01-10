/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        './src/**/*.{js,jsx,ts,tsx,html}',
    ],
    theme: {
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
                    hover: "#00CC6A"
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
            animation: {
                "glow": "glow 2s ease-in-out infinite",
            },
            keyframes: {
                "glow": {
                    "0%, 100%": { boxShadow: "0 0 20px rgba(0, 255, 136, 0.3)" },
                    "50%": { boxShadow: "0 0 30px rgba(0, 255, 136, 0.5)" },
                },
            }
        },
    },
    plugins: [],
}
