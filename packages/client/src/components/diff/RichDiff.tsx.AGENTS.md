# RichDiff.tsx — index

Pure rich-diff rendering primitive over `@git-diff-view/react` + lowlight. Exports `RichDiff` (props: `oldText`, `newText`, `filePath`, `mode`, `maxHeight`, `wrap`), `EXT_LANG_MAP`, `getLang`. Explicit 13px diff type. `wrap` defaults true for chat; editor panels pass false for horizontal source scrolling. Theme-aware via `useThemeContext`. No toolbar/toggle chrome.
