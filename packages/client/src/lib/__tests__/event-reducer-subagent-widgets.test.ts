/**
 * pi-subagents widget events are consumed by the subagents plugin from the session
 * events store; they must not appear as transcript rows.
 * See change: rewrite-subagent-inspector-for-pi-subagents.
 */
import type { DashboardEvent } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { describe, expect, it } from "vitest";
import { createInitialState, reduceEvent } from "../chat/event-reducer.js";

const widget = (eventType: string): DashboardEvent =>
	({ eventType, timestamp: 1, data: { widget: "subagent-async", lines: [] } }) as unknown as DashboardEvent;

describe("subagent widget events in the transcript", () => {
	for (const eventType of ["subagent_status", "subagent_inspect"]) {
		it(`does not add a raw row for ${eventType}`, () => {
			const state = reduceEvent(createInitialState(), widget(eventType));
			expect(state.messages.filter((m) => m.role === "rawEvent")).toEqual([]);
		});
	}

	it("still shows an unrecognised event as a raw row", () => {
		const state = reduceEvent(createInitialState(), widget("some_unknown_event"));
		expect(state.messages.filter((m) => m.role === "rawEvent")).toHaveLength(1);
	});
});
