## 1. Installed-package check (client)

- [x] 1.1 Write L1 test in `packages/client/src/hooks/__tests__/useInstalledPiPackages.test.ts` and verify it fails before implementation: rpiv-todo-panel (installed check). Triple: input: rows `[{name:"@juicesharp/rpiv-todo"}]` vs `[{name:"pi-web-access"}]` · trigger: `isPiPackageInstalled(rows, RPIV_TODO_PACKAGE)` · observable: true, then false; `undefined` rows → false
- [x] 1.2 Implement `RPIV_TODO_PACKAGE` (in `lib/session/session-todos.ts`), `isPiPackageInstalled`, and `useInstalledPiPackages()` (fetches `GET /api/packages/installed`, returns `Set<string> | null`); verify 1.1 passes

## 2. Gate the panel (client)

- [x] 2.1 Write L1 test in `packages/client/src/components/editor-pane/__tests__/EditorPane.test.tsx` and verify it fails before implementation: rpiv-todo-panel (hidden). Triple: input: `tasksEnabled={false}` · trigger: render · observable: no `inspector-tasks` button; with `tasksEnabled` true the button is present
- [x] 2.2 Write L1 test in the same file and verify it fails before implementation: rpiv-todo-panel (uninstalled while open). Triple: input: `workPanel="tasks"`, `tasksEnabled` switched to false · trigger: rerender · observable: `setWorkPanel("editor")` is called
- [x] 2.3 Implement `tasksEnabled` (default true) in `EditorPane.tsx`: hide the button and panel, fall back to editor; wire `App.tsx` to pass `todoSnapshot` as null and `tasksEnabled` from the hook; verify 2.1 and 2.2 pass

## 3. Verify

- [x] 3.1 Run the touched test files with `HOME=$(mktemp -d) npx vitest run <paths>` (plain `npm test -- <path>` ignores the path filter and runs the whole suite) and confirm they pass
- [x] 3.2 (verified in browser: chip and tab hidden without rpiv-todo, shown with it) Rebuild the client (`npm run build`), restart the server, and confirm in the UI that the Tasks tab disappears when rpiv-todo is uninstalled and returns when reinstalled
