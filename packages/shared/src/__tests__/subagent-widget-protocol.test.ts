/** Shared protocol for pi-subagents widget forwarding (rewrite-subagent-inspector-for-pi-subagents). */
import { describe, expect, it } from "vitest";
import { SUBAGENT_WIDGET_CHANNELS, SUBAGENT_WIDGET_FORWARD_AS, SUBAGENT_WIDGET_KEY_FIELD, SUBAGENT_WIDGET_KEYS } from "../subagent-widget-protocol.js";

describe("subagent widget protocol", () => {
	it("maps each pi-subagents widget key to exactly one channel", () => {
		expect(SUBAGENT_WIDGET_CHANNELS).toEqual({
			"subagent-async": "subagents:status",
			"subagent-inspect": "subagents:inspect",
		});
		expect(Object.keys(SUBAGENT_WIDGET_CHANNELS).sort()).toEqual([...SUBAGENT_WIDGET_KEYS].sort());
	});

	it("groups by a scalar payload field named widget", () => {
		expect(SUBAGENT_WIDGET_KEY_FIELD).toBe("widget");
	});

	it("forwards each channel under a stable event type", () => {
		expect(SUBAGENT_WIDGET_FORWARD_AS).toEqual({
			"subagents:status": "subagent_status",
			"subagents:inspect": "subagent_inspect",
		});
	});
});
