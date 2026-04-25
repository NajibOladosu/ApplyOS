"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Prevent hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const cycleTheme = () => {
        if (theme === "light") {
            setTheme("dark");
        } else if (theme === "dark") {
            setTheme("system");
        } else {
            setTheme("light");
        }
    };

    if (!mounted) {
        return (
            <button
                className="relative p-2 rounded-md hover:bg-secondary/80 transition-colors"
                aria-label="Toggle theme"
            >
                <Sun className="h-[1.2rem] w-[1.2rem] text-foreground" />
            </button>
        );
    }

    return (
        <button
            onClick={cycleTheme}
            className="relative p-2 rounded-md hover:bg-secondary/80 transition-colors"
            aria-label={`Current theme: ${theme}. Click to switch.`}
            title={`Theme: ${theme}`}
        >
            {theme === "light" && (
                <Sun className="h-[1.2rem] w-[1.2rem] text-foreground" />
            )}
            {theme === "dark" && (
                <Moon className="h-[1.2rem] w-[1.2rem] text-foreground" />
            )}
            {theme === "system" && (
                <Monitor className="h-[1.2rem] w-[1.2rem] text-foreground" />
            )}
        </button>
    );
}
