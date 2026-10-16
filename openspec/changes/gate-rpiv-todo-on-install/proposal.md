## Why

The Tasks tab and the header task count show the session's todo list. That list comes from pi's `rpiv-todo` extension (`@juicesharp/rpiv-todo`). When the extension is uninstalled, the dashboard still shows an empty Tasks tab. The dashboard should follow what is installed in pi.

The todo feature stays in core for now. A full plugin conversion needs a new inspector-panel slot in the plugin runtime, which is out of scope here.

## What Changes

- The client reads the installed pi packages from the existing `GET /api/packages/installed` route.
- The Tasks tab, its panel, and the header count appear only when `@juicesharp/rpiv-todo` is installed (any version).
- Until the installed list loads, the Tasks tab stays hidden.
- If the Tasks tab is active when the package disappears, the editor pane becomes active.
- No server change, no new route, no config key.

## Capabilities

### New Capabilities
- `rpiv-todo-panel`: visibility of the session Tasks panel follows the installed state of `@juicesharp/rpiv-todo`.

### Modified Capabilities
- None.

## Impact

- **Client** (`packages/client/src/App.tsx`, `components/editor-pane/EditorPane.tsx`, `lib/session/session-todos.ts`, new `hooks/useInstalledPiPackages.ts`): gate the todo selector, the Tasks button and panel, and the count.
- **Tests**: L1 tests for the hook's installed-name check, and EditorPane with `tasksEnabled` false and true.
- **Docs**: none beyond the spec delta; `docs/` updates go through DocScribe later.

## Discipline Skills

- None apply. This is a display gate with no auth, untrusted input, or latency budget.
