# monaco-theme.ts — index

`buildMonacoTheme(themeName, resolved)` derives Monaco `IStandaloneThemeData` from `THEMES` token map. Maps hex bg/fg/gutter/selection colors + accent token rules. Skips rgba tokens (Monaco rejects). base=vs-dark\|vs. Stable name `pi-monaco-<themeName>-<resolved>`. Extra rules keep Python quotes (`string.escape`), hex (`number.hex`), decorators, and `self` on dashboard accents instead of the inherited vs palette. See change: add-internal-monaco-editor-pane.
