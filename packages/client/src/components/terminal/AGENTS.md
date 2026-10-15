# DOX — packages/client/src/components/terminal

Files in this directory. One row per source file. See change: fold-oversized-agents-directories.

| File | Purpose |
|------|---------|
| `InlineTerminalCard.tsx` | Inline interactive terminal card. Live → bounded `TerminalView` reattach via `terminalId`. Frozen → read-only xterm replays transcript. Independent from LLM. See change: add-inline-terminal-card. Card root carries `data-testid="terminal-card"` + `data-terminal-state="live\|frozen"` (E2E selector; an untouched card is REMOVED from the stream, so absence is meaningful). See change: preserve-inline-terminal-transcript. |
| `ProcessList.tsx` | Repurposed as BackgroundProcessesDrawer (filename kept). Renders bridge PGID scan as collapsible drawer under… → see `ProcessList.tsx.AGENTS.md` |
| `TerminalView.tsx` | xterm.js terminal emulator wrapper with keep-alive. Live and frozen terminals use regular 13px Iosevka Term with Menlo/Monaco/monospace fallback, lineHeight 1.35, no cursor blink. Both wait for font loading before opening/measuring; live sends fitted dimensions on socket open without reconnecting, frozen fits before replay. Font completion ignores disposed instances. Regression: `__tests__/terminal-font.test.tsx`. Adds `heightPx?` bounded fixed-height variant for inline… → see `TerminalView.tsx.AGENTS.md` |
