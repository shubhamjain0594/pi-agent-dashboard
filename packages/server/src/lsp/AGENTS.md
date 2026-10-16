# DOX — packages/server/src/lsp

Server-side LSP bridge. Spawns a language server per WebSocket (`/ws/lsp?cwd&language`) and relays JSON-RPC to the dashboard editor. Only TypeScript/JavaScript (TypeScript 7 native server, `tsc --lsp --stdio` via the `typescript-7` alias) and Python (`ty server`). Workspace must be trusted before any server starts. See change: add-lsp-bridge.

Files in this directory. One row per source file.

| File | Purpose |
|------|---------|
| `lsp-framing.ts` | LSP base-protocol framing. `encodeLspMessage(message)` → Buffer with `Content-Length`. `LspFrameParser.push(chunk)` yields complete bodies; header capped at 8 KiB, body at `MAX_LSP_BODY_BYTES` (16 MiB). Explicit fields (no parameter properties; `erasableSyntaxOnly`). |
| `lsp-trust.ts` | Per-workspace trust store. `createLspTrustStore(filePath?)` → `{isTrusted(root), setTrusted(root, trusted)}`. File `~/.pi/dashboard/lsp-trust.json` (`{trustedRoots: string[]}`). Corrupt file ⇒ nothing trusted. `normalizeWorkspaceRoot(root)`. |
| `lsp-languages.ts` | `LSP_LANGUAGES`, `isLspLanguage`, `lspLanguageForPath(filePath)`, `resolveLspCommand(language, pathEnv?)`. TS: `process.execPath` + `typescript-7/bin/tsc --lsp --stdio` (resolved by package path; `typescript` stays 5.x for the JS API). Python: `ty server` found on PATH. |
| `lsp-path-guard.ts` | `isFileUriInsideRoot(uri, root)`. Realpath + `path.relative` containment for `file://` URIs sent by the client. |
| `lsp-session.ts` | `LspSession`: one spawned language-server process. `lspChildEnv(source)` allowlists `PATH, HOME, LANG, LC_ALL, LC_CTYPE, TMPDIR, USER`. Spawns via `platform/exec.js` `spawn` (required by `no-direct-child-process` guard). Idle timeout; `send`, `close`, `isClosed`. |
| `lsp-policy.ts` | JSON-RPC policy. `filterClientMessage(raw, root)` / `filterServerMessage(raw, root)` → `{kind: forward\|reply\|drop}`. Client method allowlist; document URIs must stay inside root; `pinInitializeRoot` pins `rootUri`/`workspaceFolders` to the trusted root. `LOCAL_SERVER_REQUESTS` answered locally (e.g. `workspace/configuration`). |
| `lsp-bridge.ts` | `createLspBridge({isKnownSessionCwd, trust, idleTimeoutMs, ...})` → `{handleUpgrade(request, socket, head, principalExpiresAt?), close()}`. Gates: 400 bad params, 403 unknown cwd or untrusted, 503 server not installed. `WebSocketServer({noServer, maxPayload: 8 MiB})`. Wired in `server.ts` under scope `lsp` (`gateRoadUpgrade(workspaceRead)`). |
| `__tests__/` | Unit + integration tests. `fixtures/fake-lsp-server.mjs` is a stdio stand-in for a language server. |
