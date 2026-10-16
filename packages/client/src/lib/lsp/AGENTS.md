# DOX — packages/client/src/lib/lsp

Client side of the LSP bridge. Connects Monaco to the server's `/ws/lsp` socket. Connects only when the workspace is trusted. See change: add-lsp-bridge.

Files in this directory. One row per source file.

| File | Purpose |
|------|---------|
| `lsp-connection.ts` | `lspLanguageForPath(path)`. `LspConnection.open({cwd, language, onDiagnostics})` opens `/ws/lsp?cwd&language` with a `lsp`-scoped WS ticket. `request(method, params, timeoutMs)` (10 s default; 30 s for `initialize`), `notify`, `close()`. Exports `LspDiagnostic`. |
| `lsp-monaco.ts` | Monaco glue. `diagnosticsToMarkers(monaco, diagnostics)` → `setModelMarkers`. `attachLspToModel(monaco, conn, {language, model, fileUri, text})` registers hover/definition/completion providers, guarded on `model.uri`, and returns a disposer. Same-file definitions stay on this model; other workspace files are returned as `file://` URIs for the editor opener. |
| `use-lsp-intelligence.ts` | `useLspIntelligence({cwd, path, text, monaco, model, onOpenFile?})` → `{language, status, trust}`. Fetches `/api/lsp/status`; attaches only when `trusted`. `trust()` calls `setLspTrust(cwd, true)`. `fileUriFor(cwd, relPath)` assumes POSIX paths. `relPathFromFileUri` / `definitionOpenTarget` map a definition URI back to a workspace path. `registerEditorOpener` calls `onOpenFile` for a different file so it opens as a tab. |
| `__tests__/lsp-client.test.ts` | Language mapping, `fileUriFor`, `attachLspToModel`, `diagnosticsToMarkers`. |
