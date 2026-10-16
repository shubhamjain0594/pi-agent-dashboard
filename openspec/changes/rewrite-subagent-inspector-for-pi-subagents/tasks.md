## 1. Confirm the surface (design gate)

- [x] 1.1 Verify the bridge forwards `subagent-async` and `subagent-inspect` widget updates to the server; record the path in design.md (done: bridge does not forward; a wrap of ctx.ui.setWidget is needed, see design.md Findings)
- [x] 1.2 Pin the `PI_SUBAGENT_ASYNC_JSON` and `pi-subagents.inspect-reply` schema versions from pi-subagents' source and docs; record them in design.md
- [x] 1.3 Write the spec delta for `subagents-plugin-state` and `subagent-details-payload` once 1.1 and 1.2 are recorded

## 2a. Bridge forwarding (extension)

- [x] 2a.1 Write L1 tests in `packages/extension/src/bridge-handlers/__tests__/subagent-widget-forward.test.ts` for the wrap (forward status/inspect lines in RPC, delegate to original, skip other keys, skip TUI, skip factories, no double wrap) and `isRpcLaunch`
- [x] 2a.2 Implement `subagent-widget-forward.ts` and install it in `registerSessionStart`; RPC is read from argv because pi reports `hasUI=true` in RPC mode
- [x] 2a.4 Clear handling: pi-subagents' clear (`setWidget(key, undefined)`) is forwarded as `lines: []`; the server clears that session's snapshot on an empty update (tests in both packages)
- [x] 2a.5 Release a session's status store on session end (`ctx.onSessionEnded`)
- [x] 2a.3 End-to-end check: real pi in RPC mode with the bridge and a test extension; a fake dashboard socket received one `subagent-widget` message (`subagent-async`) and no message for the unrelated widget

## 2b. Status channel (latest-only)

- [x] 2b.1 Write L1 test: a status update reaches the client as the latest value only (history not grown per tick)
- [x] 2b.2 Declare the forwarded channel (`latest`, keyed) in the subagents plugin bridge and emit status through it; keep `subagent-widget` server handling as the fallback path until removed
- [x] 2b.3 Verify end to end: real pi RPC session → browser session store receives the latest snapshot only

## 4a. Tree UI (client)

- [x] 4a.1 Write L1 tests for the tree: runs are folders, children nest, expand/collapse, sub-tab hidden without runs
- [x] 4a.2 Implement the sub-tab under Tasks and the tree component
- [x] 4a.3 Clicking an item replaces the session view with the inspector; Back returns

## 4b. Inspect (server + client)

- [x] 4b.1 Send `/subagents-inspect-rpc <requestId> <asyncId> [childId]` through `sendToSession`; match replies by requestId
- [x] 4b.2 Show task, transcript, and final output in the inspector view
- [x] 4b.3 Verify parity against the pi-subagents inspect output for the same run (live run 8840f387…, 2026-10-16: inspector shows run id, state `complete`, and final output `OK`, matching `subagent({action:"status"})`. `/subagents-inspect` is not a command in pi-subagents 0.78; the RPC command is `/subagents-inspect-rpc`)

## 2. Ingest status (server)

- [x] 2.1 Write L1 test in `packages/subagents-plugin/src/server/__tests__/status-payload.test.ts` and verify it fails before implementation: subagents-plugin-state (status ingest). Triple: input: a `PI_SUBAGENT_ASYNC_JSON:` payload, a bad-version payload, an oversized payload · trigger: parse · observable: runs listed for the good payload; bad version and oversize rejected, nothing listed
- [x] 2.2 Implement the status parser and wire it to the widget path; verify 2.1 passes

## 3. Inspect on demand (server)

- [x] 3.1 (superseded: correlation moved to the browser, see 4b; parser and tests in `packages/subagents-plugin/src/shared/`) Write L1 test in `packages/subagents-plugin/src/server/__tests__/inspect-reply.test.ts` and verify it fails before implementation: subagent-details-payload (inspect). Triple: input: a reply with a matching `requestId`, an unmatched one, one containing a filesystem path · trigger: correlate · observable: matched reply returned; unmatched dropped; path-bearing reply rejected
- [x] 3.2 (superseded by 4b.1 and 4b.2: the browser sends the command and matches replies by requestId)

## 4. Client views

- [x] 4.1 (superseded: the old producer types are not used by the new view; the new shapes are in `shared/widget-payloads.ts`) Map the new status and detail shapes to the existing view types in `packages/subagents-plugin/src/client/types.ts`; test first with a fixture payload
- [x] 4.2 (old views left unchanged; they still serve the Agent tool renderer and the old popout route, see follow-ups) Update `SubagentDetailView` and `SubagentPopoutPage` props to the mapped types; keep their existing tests green

## 5. Remove the producer dependency

- [x] 5.1 Delete `server/producer-file.ts` and its tests; remove `SubagentsSettings` fields that mirrored the producer file
- [x] 5.2 Remove `pi-dashboard-subagents` from the plugin requirements and the manifest

## 6. Enable and verify

- [x] 6.1 Set `defaultEnabled` back to true (or drop it) in `packages/subagents-plugin/package.json` once 1–5 pass
- [x] 6.2 Rebuild the client, restart the server, and confirm a live pi-subagents run appears in the inspector (live async run appeared as `worker` under Tasks → Subagents; detail showed final output)
