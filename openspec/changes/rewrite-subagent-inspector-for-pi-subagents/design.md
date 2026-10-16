## Context

pi-subagents 0.78.0 documents two host surfaces (`docs/observability.md`):

1. **Live status over RPC.** RPC hosts receive a bounded status widget, `subagent-async`, whose first line is `PI_SUBAGENT_ASYNC_JSON:<JSON>`.
2. **On-demand inspect.** `/subagents-inspect-rpc <requestId> <asyncId> [childId] [--lines N]` runs as an extension command over RPC without a model turn. The reply is one emit-then-retract update on the `subagent-inspect` widget key, `PI_SUBAGENT_INSPECT_JSON:<JSON>`, with a versioned `pi-subagents.inspect-reply` payload. Hosts must not render these widgets; they buffer by `requestId` and drop unmatched replies.

Run artifacts live under `<tmpdir>/pi-subagents-<scope>/async-subagent-runs/<id>/` (`status.json`, `events.jsonl`, `output-<n>.log`, `subagent-log-<id>.md`). The inspect reply is the documented read path; the dashboard should not read those files directly.

The current plugin reads `pi-dashboard-subagents` through `server/producer-file.ts`. That path goes away.

## Decisions

- **Read through widgets, not files.** The inspect reply and status payload are versioned and bounded (64 KB budget, explicit `truncated` markers). Reading `status.json` directly would couple us to unstable internals.
- **Keep the inspect payload's no-path guarantee.** The server forwards replies without adding paths.
- **Match replies by `requestId`.** Unmatched or late replies are dropped, as the docs require.
- **Plugin stays disabled** (`defaultEnabled: false`) until the port is complete. That keeps the broken inspector out of the running dashboard.

## Findings (resolved)

- **Widget forwarding does not exist today.** pi's RPC mode turns `ctx.ui.setWidget(key, lines)` into a stdout event `extension_ui_request` with `method: "setWidget"`, `widgetKey`, `widgetLines` (`@earendil-works/pi-coding-agent/dist/modes/rpc/rpc-mode.js:123-133`). The server drops it: the legacy `extension_ui_request` handler was removed (`packages/server/src/event-wiring.ts:2384`). The bridge does not wrap `ctx.ui.setWidget` (`packages/extension/src/bridge-handlers/ui-prompt-patch.ts` patches prompt primitives only).
- **Therefore the bridge needs a change.** Wrap `ctx.ui.setWidget` for the keys `subagent-async` and `subagent-inspect` only, and send their lines to the server as a plugin message. Scope: RPC (dashboard-spawned) sessions only. TUI sessions render the widget in the terminal and send nothing.
- **Status schema:** `pi-subagents.async-status-snapshot`, version `1`, first line prefix `PI_SUBAGENT_ASYNC_JSON:`, with `caps` and `omitted` fields (`src/runs/shared/async-status-projection.js:7-8,528-544`). Accept version 1 only.
- **Inspect schema:** `pi-subagents.inspect-reply`, version `1`, prefix `PI_SUBAGENT_INSPECT_JSON:`, `requestId` matching `^[A-Za-z0-9_-]{1,64}$`, reply capped at 64 KB serialized (`src/runs/background/inspect-rpc.js:12-25`). Accept version 1 only.
- **Send the inspect command as a prompt over RPC.** The docs say extension commands run inline with no model turn. Confirm this during implementation (task 3.2).

- **Transport already exists.** The bridge's generic plugin channel `dashboard:plugin-message` wraps a payload as `plugin_pi_message` and the server routes it to the plugin's `registerPiHandler` (`packages/extension/src/bridge-handlers/lifecycle.ts`, change add-goal-continuation-plugin). The widget wrap sends `{pluginId: "subagents", messageType: "subagent-widget", payload: {key, lines}}` through it. No new server route.

## Remaining risk

- The bridge wrap runs inside pi's process, so it must not change how `setWidget` behaves for the TUI or other extensions. Wrap by delegating to the original method.

## UI decisions (agreed)

- **Placement.** Subagents is a sub-tab under the session's Tasks tab (EditorPane inspector). Choosing a run replaces the session chat view with the subagent inspector; a Back action returns to the session.
- **Tree layout.** Like a file explorer: each run is a folder, its child subagents are nested subfolders, expand/collapse per node. The status snapshot already carries this tree (runs → steps → materialized children, see pi-subagents `runs/shared/async-status-projection.js` `projectRun`).
- **Feature parity.** Read-only, matching `/subagents-inspect-rpc`: run list, live status, child task, transcript, final output. Steer and stop are out of scope for this change.
- **Gating.** The sub-tab appears only when a status snapshot with runs exists for the session. No plugin coupling in core.

## Status channel (agreed: latest-only)

- Live status is delivered as a forwarded channel with `latest` delivery, so only the newest status per session is retained in history. Normal session events would store every update.
- Inspect replies follow the same route, keyed by `requestId`.
