/**
 * Parsing pi-subagents' widget lines (browser and server share this module).
 * Spec: openspec/changes/rewrite-subagent-inspector-for-pi-subagents
 *   (pi-subagents-inspector: status ingest, inspect correlation and bounds).
 */
import { describe, expect, it } from "vitest";
import {
	MAX_STATUS_LINE_BYTES,
	inspectRepliesFromEvents,
	latestStatusSnapshot,
	parseAsyncStatusLines,
	parseInspectLines,
} from "../widget-payloads.js";

const STATUS = "PI_SUBAGENT_ASYNC_JSON:";
const INSPECT = "PI_SUBAGENT_INSPECT_JSON:";

function statusLine(overrides: Record<string, unknown> = {}): string {
	const body = {
		kind: "pi-subagents.async-status-snapshot",
		version: 1,
		generatedAt: 1,
		caps: {},
		omitted: { runs: 0, children: 0, byteLimitExceeded: false },
		runs: [{ id: "a1", state: "running" }],
		...overrides,
	};
	return `${STATUS}${JSON.stringify(body)}`;
}

function inspectLine(overrides: Record<string, unknown> = {}): string {
	const body = {
		kind: "pi-subagents.inspect-reply",
		version: 1,
		requestId: "rq_1",
		asyncId: "a1",
		status: "running",
		task: "do the thing",
		messages: [{ role: "assistant", kind: "text", text: "hello" }],
		...overrides,
	};
	return `${INSPECT}${JSON.stringify(body)}`;
}

describe("parseAsyncStatusLines", () => {
	it("accepts the documented kind and version 1", () => {
		const r = parseAsyncStatusLines([statusLine()]);
		expect(r.ok && r.snapshot.runs).toEqual([{ id: "a1", state: "running" }]);
	});
	it("rejects an unknown version", () => {
		expect(parseAsyncStatusLines([statusLine({ version: 2 })])).toEqual({ ok: false, reason: "unsupported-version" });
	});
	it("rejects an unknown kind", () => {
		expect(parseAsyncStatusLines([statusLine({ kind: "other" })])).toEqual({ ok: false, reason: "unsupported-kind" });
	});
	it("rejects malformed JSON", () => {
		expect(parseAsyncStatusLines([`${STATUS}{not json`])).toEqual({ ok: false, reason: "invalid-json" });
	});
	it("rejects an oversized line without parsing it", () => {
		expect(parseAsyncStatusLines([`${STATUS}${"x".repeat(MAX_STATUS_LINE_BYTES)}`])).toEqual({ ok: false, reason: "too-large" });
	});
	it("reports no-snapshot when no line has the prefix", () => {
		expect(parseAsyncStatusLines(["plain"])).toEqual({ ok: false, reason: "no-snapshot" });
	});
});

describe("latestStatusSnapshot (latest-only channel)", () => {
	const ev = (lines: unknown) => ({ eventType: "subagent_status", timestamp: 1, data: { lines } });

	it("is null before any status", () => {
		expect(latestStatusSnapshot([])).toBeNull();
	});
	it("returns the newest accepted snapshot", () => {
		const snap = latestStatusSnapshot([ev([statusLine({ runs: [{ id: "old" }] })]), ev([statusLine({ runs: [{ id: "new" }] })])]);
		expect(snap?.runs).toEqual([{ id: "new" }]);
	});
	it("keeps the previous snapshot when a later update is rejected", () => {
		const snap = latestStatusSnapshot([ev([statusLine({ runs: [{ id: "keep" }] })]), ev([statusLine({ version: 9 })])]);
		expect(snap?.runs).toEqual([{ id: "keep" }]);
	});
	it("a clear keeps the runs of the last snapshot, marked as ended (finished runs stay inspectable)", () => {
		const snap = latestStatusSnapshot([ev([statusLine({ runs: [{ id: "a1", state: "running" }] })]), ev([])]);
		expect(snap?.runs).toEqual([{ id: "a1", state: "running", ended: true }]);
	});
	it("a clear with nothing before it stays null", () => {
		expect(latestStatusSnapshot([ev([])])).toBeNull();
	});
	it("a new run after a clear replaces the ended runs", () => {
		const snap = latestStatusSnapshot([ev([statusLine({ runs: [{ id: "old" }] })]), ev([]), ev([statusLine({ runs: [{ id: "new" }] })])]);
		expect(snap?.runs).toEqual([{ id: "new" }]);
	});
	it("ignores events of other types", () => {
		const other = { eventType: "subagent_inspect", timestamp: 1, data: { lines: [statusLine()] } };
		expect(latestStatusSnapshot([other])).toBeNull();
	});
});

describe("parseInspectLines", () => {
	it("accepts a version 1 reply and returns its requestId", () => {
		const r = parseInspectLines([inspectLine()]);
		expect(r.ok && r.requestId).toBe("rq_1");
		expect(r.ok && r.reply.task).toBe("do the thing");
	});
	it("rejects an unknown version", () => {
		expect(parseInspectLines([inspectLine({ version: 2 })])).toEqual({ ok: false, reason: "unsupported-version" });
	});
	it("rejects a requestId outside the documented pattern", () => {
		expect(parseInspectLines([inspectLine({ requestId: "bad id!" })])).toEqual({ ok: false, reason: "invalid-request-id" });
	});
	it("rejects a reply that carries a filesystem-looking field", () => {
		expect(parseInspectLines([inspectLine({ sessionFile: "/home/me/.pi/x.jsonl" })])).toEqual({ ok: false, reason: "contains-path" });
	});
	it("rejects a line with no inspect prefix", () => {
		expect(parseInspectLines([statusLine()])).toEqual({ ok: false, reason: "no-reply" });
	});
});

describe("inspectRepliesFromEvents", () => {
	it("collects valid replies by requestId and skips bad ones", () => {
		const events = [
			{ eventType: "subagent_inspect", data: { lines: [inspectLine({ requestId: "rq_a" })] } },
			{ eventType: "subagent_inspect", data: { lines: [inspectLine({ requestId: "rq_b", version: 9 })] } },
			{ eventType: "subagent_inspect", data: { lines: [inspectLine({ requestId: "rq_c" })] } },
			{ eventType: "subagent_status", data: { lines: [inspectLine({ requestId: "rq_d" })] } },
		];
		const map = inspectRepliesFromEvents(events);
		expect([...map.keys()].sort()).toEqual(["rq_a", "rq_c"]);
		expect(map.get("rq_a")?.task).toBe("do the thing");
	});
});
