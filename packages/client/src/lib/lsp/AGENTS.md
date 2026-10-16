# DOX — packages/client/src/lib/lsp

Client side of the LSP bridge. Connects Monaco to the server's `/ws/lsp` socket. Connects only when the workspace is trusted. See change: add-lsp-bridge.

Files in this directory. One row per source file.

| File | Purpose |
|------|---------|
| `lsp-connection.ts` | `lspLanguageForPath(path)`. `LspConnection.open({cwd, language, onDiagnostics})` opens `/ws/lsp?cwd&language` with a `lsp`-scoped WS ticket. `request(method, params, timeoutMs)` (10 s default; 30 s for `initialize`), `notify`, `close()`. Exports `LspDiagnostic`. |
| `lsp-monaco.ts` | Monaco glue. `diagnosticsToMarkers(monaco, diagnostics)` → `setModelMarkers`. `attachLspToModel(monaco, conn, {language, model, fileUri, text})` registers hover/definition/completion providers, guarded on `model.uri`, and returns a disposer. Definitions filtered to the same file (cross-file navigation not supported). |
| `use-lsp-intelligence.ts` | `useLspIntelligence({cwd, path, text, monaco, model})` → `{language, status, trust}`. Fetches `/api/lsp/status`; attaches only when `trusted`. `trust()` calls `setLspTrust(cwd, true)`. `fileUriFor(cwd, relPath)` assumes POSIX paths. |
| `__tests__/lsp-client.test.ts` | Language mapping, `fileUriFor`, `attachLspToModel`, `diagnosticsToMarkers`. |
