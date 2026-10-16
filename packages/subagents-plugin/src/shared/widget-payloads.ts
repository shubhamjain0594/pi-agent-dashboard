/**
 * Parse pi-subagents' widget lines. Shared by the browser (inspector, tree) and
 * tests. Schemas: pi-subagents `runs/shared/async-status-projection.js` (status,
 * kind `pi-subagents.async-status-snapshot`) and `runs/background/inspect-rpc.js`
 * (inspect reply, kind `pi-subagents.inspect-reply`). Both are version 1.
 * See change: rewrite-subagent-inspector-for-pi-subagents.
 */

export const STATUS_PREFIX = "PI_SUBAGENT_ASYNC_JSON:";
export const STATUS_KIND = "pi-subagents.async-status-snapshot";
export const STATUS_VERSION = 1;
export const INSPECT_PREFIX = "PI_SUBAGENT_INSPECT_JSON:";
export const INSPECT_KIND = "pi-subagents.inspect-reply";
export const INSPECT_VERSION = 1;
/** Hard cap on one status line. Oversized lines are dropped before parsing. */
export const MAX_STATUS_LINE_BYTES = 512 * 1024;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** Field names that would expose a filesystem location. pi's replies never carry them. */
const PATH_KEY_RE = /(^|_)(path|file|dir|cwd)$|[a-z](Path|File|Dir|Cwd)$/;

export interface AsyncStatusNode {
	/** Set by the browser when pi-subagents cleared its widget: the run has finished. */
	ended?: boolean;
	id?: string;
	kind?: string;
	label?: string;
	state?: string;
	startedAt?: number;
	updatedAt?: number;
	endedAt?: number;
	steps?: unknown[];
	children?: AsyncStatusNode[];
	[key: string]: unknown;
}

export interface AsyncStatusSnapshot {
	kind: typeof STATUS_KIND;
	version: typeof STATUS_VERSION;
	runs: AsyncStatusNode[];
	[key: string]: unknown;
}

export type StatusParseResult =
	| { ok: true; snapshot: AsyncStatusSnapshot }
	| { ok: false; reason: "no-snapshot" | "too-large" | "invalid-json" | "unsupported-kind" | "unsupported-version" };

export interface InspectReply {
	kind: typeof INSPECT_KIND;
	version: typeof INSPECT_VERSION;
	requestId: string;
	asyncId?: string;
	childId?: string;
	status?: string;
	label?: string;
	task?: string;
	messages?: Array<{ role?: string; kind?: string; text?: string; name?: string; isError?: boolean }>;
	finalOutput?: string;
	truncated?: { task?: boolean; finalOutput?: boolean; messages?: number };
	error?: { code: string; message: string };
	[key: string]: unknown;
}

export type InspectParseResult =
	| { ok: true; requestId: string; reply: InspectReply }
	| { ok: false; reason: "no-reply" | "invalid-json" | "unsupported-kind" | "unsupported-version" | "invalid-request-id" | "contains-path" };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasPathKey(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(hasPathKey);
	if (!isRecord(value)) return false;
	return Object.entries(value).some(([k, v]) => PATH_KEY_RE.test(k) || hasPathKey(v));
}

/** Parse the first status line. Pure. */
export function parseAsyncStatusLines(lines: readonly string[]): StatusParseResult {
	const line = lines.find((l) => l.startsWith(STATUS_PREFIX));
	if (line === undefined) return { ok: false, reason: "no-snapshot" };
	if (line.length > MAX_STATUS_LINE_BYTES) return { ok: false, reason: "too-large" };
	let parsed: unknown;
	try {
		parsed = JSON.parse(line.slice(STATUS_PREFIX.length));
	} catch {
		return { ok: false, reason: "invalid-json" };
	}
	if (!isRecord(parsed) || parsed.kind !== STATUS_KIND || !Array.isArray(parsed.runs)) {
		return { ok: false, reason: "unsupported-kind" };
	}
	if (parsed.version !== STATUS_VERSION) return { ok: false, reason: "unsupported-version" };
	return { ok: true, snapshot: parsed as AsyncStatusSnapshot };
}

/** Parse the first inspect-reply line. Pure. */
export function parseInspectLines(lines: readonly string[]): InspectParseResult {
	const line = lines.find((l) => l.startsWith(INSPECT_PREFIX));
	if (line === undefined) return { ok: false, reason: "no-reply" };
	let parsed: unknown;
	try {
		parsed = JSON.parse(line.slice(INSPECT_PREFIX.length));
	} catch {
		return { ok: false, reason: "invalid-json" };
	}
	if (!isRecord(parsed) || parsed.kind !== INSPECT_KIND) return { ok: false, reason: "unsupported-kind" };
	if (parsed.version !== INSPECT_VERSION) return { ok: false, reason: "unsupported-version" };
	if (typeof parsed.requestId !== "string" || !REQUEST_ID_RE.test(parsed.requestId)) {
		return { ok: false, reason: "invalid-request-id" };
	}
	if (hasPathKey(parsed)) return { ok: false, reason: "contains-path" };
	return { ok: true, requestId: parsed.requestId, reply: parsed as InspectReply };
}

/** One event as the browser sees it (`subagent_status` on the latest-only channel). */
export interface ForwardedWidgetEvent {
	eventType: string;
	data?: unknown;
}

/**
 * The status snapshot the browser should show, from the forwarded events of one
 * session. Events are in arrival order. A rejected update keeps the previous
 * snapshot. An empty update (pi-subagents' clear, sent when runs finish) keeps
 * the runs but marks them `ended`, so finished runs stay inspectable.
 */
export function latestStatusSnapshot(events: readonly ForwardedWidgetEvent[]): AsyncStatusSnapshot | null {
	let current = null as AsyncStatusSnapshot | null;
	for (const event of events) {
		if (event.eventType !== "subagent_status" || !isRecord(event.data) || !Array.isArray(event.data.lines)) continue;
		const lines = event.data.lines.filter((l): l is string => typeof l === "string");
		if (lines.length === 0) {
			// pi-subagents clears its widget when runs finish. Keep them visible as ended.
			current = current ? { ...current, runs: current.runs.map((run) => ({ ...run, ended: true })) } : null;
			continue;
		}
		const result = parseAsyncStatusLines(lines);
		if (result.ok) current = result.snapshot;
	}
	return current;
}

/**
 * Inspect replies of one session, keyed by requestId. Events are in arrival
 * order; a later reply with the same requestId replaces an earlier one. Invalid
 * lines are skipped.
 */
export function inspectRepliesFromEvents(events: readonly ForwardedWidgetEvent[]): Map<string, InspectReply> {
	const replies = new Map<string, InspectReply>();
	for (const event of events) {
		if (event.eventType !== "subagent_inspect" || !isRecord(event.data) || !Array.isArray(event.data.lines)) continue;
		const lines = event.data.lines.filter((l): l is string => typeof l === "string");
		const result = parseInspectLines(lines);
		if (result.ok) replies.set(result.requestId, result.reply);
	}
	return replies;
}

/** Most closed runs kept per session (oldest dropped first). */
export const MAX_CLOSED_RUNS = 50;

/**
 * Closed runs of one session: the previously closed runs plus any run the live
 * snapshot marks ended. A run id appears once (the snapshot's version wins).
 * A missing snapshot keeps the previous closed runs. Pure.
 */
export function mergeClosedRuns(
	previous: readonly AsyncStatusNode[],
	snapshot: AsyncStatusSnapshot | null,
): AsyncStatusNode[] {
	const byId = new Map<string, AsyncStatusNode>();
	for (const run of previous) if (typeof run.id === "string") byId.set(run.id, { ...run, ended: true });
	for (const run of snapshot?.runs ?? []) {
		if (run.ended === true && typeof run.id === "string") byId.set(run.id, { ...run, ended: true });
	}
	return [...byId.values()].slice(-MAX_CLOSED_RUNS);
}

/** Storage text for closed runs. */
export function encodeClosedRuns(runs: readonly AsyncStatusNode[]): string {
	return JSON.stringify({ runs });
}

/** Closed runs from storage text. Missing or corrupt text reads as empty. */
export function decodeClosedRuns(text: string | null): AsyncStatusNode[] {
	if (text === null) return [];
	try {
		const parsed: unknown = JSON.parse(text);
		if (!isRecord(parsed) || !Array.isArray(parsed.runs)) return [];
		return parsed.runs.filter(isRecord).map((run) => ({ ...run, ended: true }) as AsyncStatusNode);
	} catch {
		return [];
	}
}

/** Runs a session view shows: live runs first, then closed runs not already live. Pure. */
export function subagentViewRuns(
	live: AsyncStatusSnapshot | null,
	closed: readonly AsyncStatusNode[],
): AsyncStatusNode[] {
	const running = (live?.runs ?? []).filter((run) => run.ended !== true);
	const liveIds = new Set(running.map((run) => run.id));
	return [...running, ...closed.filter((run) => !liveIds.has(run.id))];
}
