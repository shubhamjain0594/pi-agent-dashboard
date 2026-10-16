/** The subagents bridge declares the status and inspect channels (rewrite-subagent-inspector-for-pi-subagents). */
import { describe, expect, it } from "vitest";
import { SUBAGENT_WIDGET_CHANNELS, SUBAGENT_WIDGET_FORWARD_AS } from "@blackbelt-technology/pi-dashboard-shared/subagent-widget-protocol.js";
import { SUBAGENTS_FORWARD_DECLARATION } from "../index.js";
import { validateDeclaration } from "@blackbelt-technology/pi-dashboard-shared/event-forward-declaration.js";

describe("SUBAGENTS_FORWARD_DECLARATION", () => {
	it("declares a latest-only status channel", () => {
		expect(SUBAGENTS_FORWARD_DECLARATION.channels["subagents:status"]).toEqual({ as: "subagent_status", delivery: "latest", key: "widget" });
	});

	it("declares the inspect channel as a stream so concurrent replies are all kept", () => {
		expect(SUBAGENTS_FORWARD_DECLARATION.channels["subagents:inspect"]).toEqual({ as: "subagent_inspect", delivery: "stream", key: "widget" });
	});

	it("declares every channel the main bridge emits, under the shared event type", () => {
		for (const channel of Object.values(SUBAGENT_WIDGET_CHANNELS)) {
			expect(SUBAGENTS_FORWARD_DECLARATION.channels[channel]?.as).toBe(SUBAGENT_WIDGET_FORWARD_AS[channel]);
		}
	});
});

describe("SUBAGENTS_FORWARD_DECLARATION passes the core validator", () => {
	it("accepts every channel (latest/stream channels must carry a key)", () => {
		const result = validateDeclaration(SUBAGENTS_FORWARD_DECLARATION, {
			existingForPlugin: 0,
			existingTotal: 0,
			isKnown: () => false,
		});
		expect(result.ok).toBe(true);
		expect(result.rejected).toEqual([]);
		expect(result.accepted.map((a) => a.channel).sort()).toEqual(
			["subagents:delta", "subagents:entry", "subagents:inspect", "subagents:status"].sort(),
		);
	});
});
