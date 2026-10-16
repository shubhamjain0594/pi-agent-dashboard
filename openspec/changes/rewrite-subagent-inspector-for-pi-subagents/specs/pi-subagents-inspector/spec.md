## ADDED Requirements

### Requirement: Widget forwarding for pi-subagents keys
The bridge SHALL forward the lines of the `subagent-async` and `subagent-inspect` widgets to the server, and only in RPC sessions. Forwarding SHALL delegate to the original `ctx.ui.setWidget` so the TUI and other extensions are unaffected.

#### Scenario: Status widget forwarded
- **WHEN** pi-subagents calls `setWidget("subagent-async", lines)` in an RPC session
- **THEN** the bridge emits `{widget: "subagent-async", lines}` on the `subagents:status` channel, which the server forwards to the browser (latest only)
- **AND** the original `setWidget` is still called

#### Scenario: Other widgets are not forwarded
- **WHEN** an extension calls `setWidget` with any other key
- **THEN** the bridge does not forward it

#### Scenario: TUI session
- **WHEN** the session is not an RPC session
- **THEN** the bridge forwards nothing

### Requirement: Status ingest accepts only the documented version
The server SHALL parse a `PI_SUBAGENT_ASYNC_JSON:` line only when its JSON has `kind` `pi-subagents.async-status-snapshot` and `version` `1`. Any other kind or version SHALL be rejected and SHALL NOT replace the last accepted snapshot.

#### Scenario: Current version accepted
- **WHEN** a line carries `kind: "pi-subagents.async-status-snapshot"` and `version: 1`
- **THEN** its runs replace the displayed run list for that session

#### Scenario: Unknown version rejected
- **WHEN** a line carries `version: 2`
- **THEN** it is ignored and the previous snapshot remains displayed

#### Scenario: Oversized line rejected
- **WHEN** a line is larger than the server's configured cap
- **THEN** it is ignored without parsing

### Requirement: Inspect replies are correlated and bounded
The browser SHALL send `/subagents-inspect-rpc <requestId> <asyncId> [childId] --lines N` to the viewed session. It SHALL accept a `PI_SUBAGENT_INSPECT_JSON:` reply only when its `requestId` matches a pending request and its kind is `pi-subagents.inspect-reply` with version `1`. Replies are forwarded on the `subagents:inspect` channel (stream, keyed by `widget`). Unmatched replies SHALL be ignored.

#### Scenario: Matched reply shown
- **WHEN** a reply arrives whose `requestId` matches a pending inspect request
- **THEN** its content is shown in the inspector for that child

#### Scenario: Unmatched reply dropped
- **WHEN** a reply arrives with no pending request
- **THEN** it is dropped and nothing is displayed

#### Scenario: Reply with a filesystem path rejected
- **WHEN** a reply contains a field that looks like an absolute filesystem path
- **THEN** the server rejects the reply and shows an inspect error instead

### Requirement: No dependency on the producer extension
The subagents plugin SHALL NOT require `pi-dashboard-subagents`, and SHALL NOT read or write `~/.pi/agent/extensions/pi-dashboard-subagents/config.json`.

#### Scenario: Plugin loads without the producer
- **WHEN** `pi-dashboard-subagents` is not installed and `pi-subagents` is installed
- **THEN** the plugin has no missing requirements
