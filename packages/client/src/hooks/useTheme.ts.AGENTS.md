# useTheme.ts — index

Theme mode + named-theme state. Reads `dashboard:theme`/`dashboard:theme-name` from `localStorage`, resolves system pref via `prefers-color-scheme`, applies `data-theme` attr + CSS var overrides. Listens for OS changes. After palette variables apply, synchronizes browser/PWA `theme-color` to computed `--bg-secondary` and root `color-scheme` to resolved mode; covers startup, explicit mode, palette and OS changes. Exports `useTheme`, `ThemeState`, `applyThemeVars`, `ThemePreference`, `ResolvedTheme`, `STORAGE_KEY`, `THEME_NAME_KEY`.
