# SplitWorkspaceContext.tsx — index

Adds optional `workPanel`/`setWorkPanel`, `todoSnapshot`, `openTasks` inspector coordination. `openChanges` selects review view; foreground file/diff/terminal opens select Editor, background opens preserve the current inspector. Panel selection is session-keyed; task data comes from the selected session's messages.

Per-session provider. Lifts `useSplitState`+`useEditorPaneState`. Exposes `openInSplit`, `setMode` (Chat│Split│Editor switch), `pendingScroll`, `changedFiles`, `clearChanged`. Content openers set `mode:"split"`. Wires filename-search + open-files watch effect (keyed `mode!=="closed"`). Adds `openChanges()` for full-width Changes review and `openDiffTab()` for `diff:` viewer tabs. Review no longer changes editor-explorer visibility; obsolete reveal-signal plumbing is removed. `toggleSplit` deleted. See change: split-editor-workspace. See change: add-change-summary-table. See change: editor-layout-modes. Adds a `terminal` slice (`useTerminalPaneTabs`): provider props `terminals`, `autoSurfaceTerminals`, `onCreateTerminal`/`onKillTerminal`/`onRenameTerminal`/`onTerminalTitle` → context `terminal: TerminalPaneTabs`. Session split threads cwd terminals opt-in; `FolderEditorView` sets `autoSurfaceTerminals`. `EMPTY_TERMINALS` stable default. Provider props `focusOnMount`/`terminalsReady`/`onFocusConsumed` forward the folder pane's one-shot terminal-focused entry. See change: terminals-in-tabbed-panes. See change: fix-terminals-action-opens-terminal.

See change: add-lazy-terminal-diff-bootstrap — lazy boundary (D2: `React.lazy` + local `Suspense`); see the directory AGENTS.md row for the runtime detail.

See change: surface-denial-remedy-in-previews — `openInSplit` opts gain `autoOpened` (provenance; independent of `background`/`restrictCsp`) → `openFile` action.

See change: add-browser-editor-pane-tab — `openPluginTab(path): boolean` (claimed-prefix check via `findEditorPaneTabClaim`, then idempotent `openFile{viewer:"plugin"}` + `ensureRevealed`); file-watch set (`openPathsKey`) excludes every pseudo-tab/plugin path.
