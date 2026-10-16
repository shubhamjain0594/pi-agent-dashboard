/**
 * Finished pi-subagents runs stay listed as closed sessions, per session, across reloads.
 * See change: rewrite-subagent-inspector-for-pi-subagents (closed runs).
 */
import { describe, expect, it } from "vitest";
import { MAX_CLOSED_RUNS, decodeClosedRuns, encodeClosedRuns, mergeClosedRuns, subagentViewRuns } from "../widget-payloads.js";

const snap = (runs: unknown[]) => ({ kind: "pi-subagents.async-status-snapshot", version: 1, runs }) as never;

describe("mergeClosedRuns", () => {
	it("adds nothing while runs are live", () => {
		expect(mergeClosedRuns([], snap([{ id: "a", state: "running" }]))).toEqual([]);
	});
	it("keeps runs that the snapshot marks ended, as closed", () => {
		expect(mergeClosedRuns([], snap([{ id: "a", state: "complete", ended: true }]))).toEqual([{ id: "a", state: "complete", ended: true }]);
	});
	it("keeps earlier closed runs when there is no snapshot", () => {
		const prev = [{ id: "a", state: "complete", ended: true }];
		expect(mergeClosedRuns(prev, null)).toEqual(prev);
	});
	it("does not duplicate a run seen twice", () => {
		const prev = [{ id: "a", state: "complete", ended: true }];
		expect(mergeClosedRuns(prev, snap([{ id: "a", state: "complete", ended: true }]))).toEqual([{ id: "a", state: "complete", ended: true }]);
	});
	it("caps the number of closed runs, keeping the newest", () => {
		const many = Array.from({ length: MAX_CLOSED_RUNS + 5 }, (_, i) => ({ id: `r${i}`, ended: true }));
		const merged = mergeClosedRuns([], snap(many));
		expect(merged).toHaveLength(MAX_CLOSED_RUNS);
		expect(merged[merged.length - 1].id).toBe(`r${MAX_CLOSED_RUNS + 4}`);
	});
});

describe("closed run storage encoding", () => {
	it("round-trips closed runs", () => {
		const runs = [{ id: "a", state: "complete", ended: true }];
		expect(decodeClosedRuns(encodeClosedRuns(runs))).toEqual(runs);
	});
	it("treats missing or corrupt storage as empty", () => {
		expect(decodeClosedRuns(null)).toEqual([]);
		expect(decodeClosedRuns("{not json")).toEqual([]);
		expect(decodeClosedRuns('{"runs":1}')).toEqual([]);
	});
});

describe("subagentViewRuns", () => {
	it("lists live runs first, then closed runs not already live", () => {
		const live = snap([{ id: "r1", state: "running" }]);
		const closed = [{ id: "r0", state: "complete", ended: true }];
		expect(subagentViewRuns(live, closed)).toEqual([{ id: "r1", state: "running" }, { id: "r0", state: "complete", ended: true }]);
	});
	it("shows only closed runs after a reload (no live snapshot)", () => {
		const closed = [{ id: "r0", state: "complete", ended: true }];
		expect(subagentViewRuns(null, closed)).toEqual(closed);
	});
	it("is empty when there is nothing to show", () => {
		expect(subagentViewRuns(null, [])).toEqual([]);
	});
});
