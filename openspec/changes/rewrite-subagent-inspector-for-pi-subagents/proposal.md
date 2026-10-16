## Why

The dashboard's subagent inspector (`packages/subagents-plugin`) reads a producer extension, `pi-dashboard-subagents`, that is not installed. The plugin is now disabled by default and shows as missing its requirement. We use `pi-subagents` (0.78.0) instead. The inspector should show runs from the package we use.

## What Changes

- Replace the `pi-dashboard-subagents` requirement with the `pi-subagents` extension.
- Build the run list and live status from the `subagent-async` widget payload (`PI_SUBAGENT_ASYNC_JSON:`) that pi-subagents sends to RPC hosts. The bridge already forwards extension UI updates to the server, so no new pi-side code is needed.
- Load per-child detail on demand with `/subagents-inspect-rpc <requestId> <asyncId> [childId]`. Its reply arrives on the `subagent-inspect` widget key as `PI_SUBAGENT_INSPECT_JSON:` with a `pi-subagents.inspect-reply` payload, correlated by `requestId`.
- Drop the producer settings mirror (`~/.pi/agent/extensions/pi-dashboard-subagents/config.json`).
- Keep the existing client views (detail view, popout, settings) where their data shape still fits; port the rest.
- Leave the plugin disabled by default until the port passes its tests.

## Capabilities

### New Capabilities
- `pi-subagents-inspector`: widget forwarding, versioned status ingest, correlated inspect replies, and no producer dependency (see `specs/pi-subagents-inspector/spec.md`).

### Modified Capabilities
- None. The existing `subagents-plugin-state` and `subagent-details-payload` specs describe the producer-based tick and timeline. They are superseded by this change and retire on archive, so they are not edited here.

## Impact

- **Server** (`packages/subagents-plugin/src/server/`): parse the widget payloads and inspect replies; drop `producer-file.ts`.
- **Client** (`packages/subagents-plugin/src/client/`): data mapping to the existing view types.
- **Bridge** (`packages/subagents-plugin/src/bridge/`): confirm which widget keys reach the server.

## Discipline Skills

- `security-hardening`: inspect replies are untrusted extension output; the reply must not expose filesystem paths, and the server must bound payload sizes.
- `doubt-driven-review`: before the spec delta is finalised, check the widget payload versions against pi-subagents' docs.
