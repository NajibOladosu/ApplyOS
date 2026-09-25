/**
 * Theme handling for the extension surface.
 *
 * The web app uses next-themes, which is Next-only. This is the equivalent in
 * ~40 lines: resolve the stored preference against the OS setting, then keep a
 * `dark` class on <html> so every token in globals.css resolves correctly.
 */

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

export function resolveTheme(preference: ThemePreference | undefined): 'light' | 'dark' {
    if (preference === 'light' || preference === 'dark') return preference
    // Default to the OS. A popup that flashes the wrong theme is more jarring
    // than one that never changes.
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function paint(theme: 'light' | 'dark'): void {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    // Lets native controls (scrollbars, form widgets) follow the theme too.
    document.documentElement.style.colorScheme = theme
}

/**
 * Read the stored preference, paint immediately, and return the value.
 *
 * `paint` runs synchronously before the first React render so there is no flash
 * of the wrong theme.
 */
export async function initTheme(): Promise<ThemePreference> {
    const stored = await chrome.storage.local.get([STORAGE_KEY])
    const preference = (stored[STORAGE_KEY] as ThemePreference) ?? 'system'
    paint(resolveTheme(preference))
    return preference
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
    const { [STORAGE_KEY]: _ignored, ...rest } = await chrome.storage.local.get(null)
    await chrome.storage.local.set({ ...rest, [STORAGE_KEY]: preference })
    paint(resolveTheme(preference))
}

/**
 * Subscribe to OS theme changes so a popup left open follows the system.
 * Returns an unsubscribe function.
 */
export function watchSystemTheme(getPreference: () => ThemePreference): () => void {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return () => {}

    const onChange = () => {
        if (getPreference() === 'system') paint(resolveTheme('system'))
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
}

/** Cycle order used by the header toggle: light → dark → system → light. */
export const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark']

export function nextTheme(current: ThemePreference): ThemePreference {
    const index = THEME_CYCLE.indexOf(current)
    return THEME_CYCLE[(index + 1) % THEME_CYCLE.length]
}
