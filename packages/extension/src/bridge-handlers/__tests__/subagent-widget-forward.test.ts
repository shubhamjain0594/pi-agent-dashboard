/**
 * Forward pi-subagents' widget lines to the dashboard as event-forward channels.
 * Spec: openspec/changes/rewrite-subagent-inspector-for-pi-subagents
 *   (pi-subagents-inspector: "Widget forwarding for pi-subagents keys").
 */
import { describe, expect, it, vi } from "vitest";
import { isRpcLaunch, wrapSubagentWidgetForward } from "../subagent-widget-forward.js";

function setup(opts: { isRpc?: boolean } = {}) {
	const original = vi.fn();
	const ui: { setWidget: (...args: unknown[]) => unknown } = { setWidget: original };
	const emitted: Array<{ channel: string; payload: unknown }> = [];
	wrapSubagentWidgetForward(ui, {
		isRpc: () => opts.isRpc ?? true,
		emit: (channel, payload) => emitted.push({ channel, payload }),
	});
	return { ui, original, emitted };
}

describe("wrapSubagentWidgetForward", () => {
	it("emits the status widget lines on the status channel and still calls the original", () => {
		const { ui, original, emitted } = setup();
		const lines = ["PI_SUBAGENT_ASYNC_JSON:{}"];
		ui.setWidget("subagent-async", lines, { placement: "aboveEditor" });
		expect(emitted).toEqual([{ channel: "subagents:status", payload: { widget: "subagent-async", lines } }]);
		expect(original).toHaveBeenCalledWith("subagent-async", lines, { placement: "aboveEditor" });
	});

	it("emits the inspect widget lines on the inspect channel", () => {
		const { ui, emitted } = setup();
		ui.setWidget("subagent-inspect", ["PI_SUBAGENT_INSPECT_JSON:{}"]);
		expect(emitted).toEqual([{ channel: "subagents:inspect", payload: { widget: "subagent-inspect", lines: ["PI_SUBAGENT_INSPECT_JSON:{}"] } }]);
	});

	it("does not emit other widget keys, but still calls the original", () => {
		const { ui, original, emitted } = setup();
		ui.setWidget("pi-dashboard-launch", ["x"]);
		expect(emitted).toEqual([]);
		expect(original).toHaveBeenCalledWith("pi-dashboard-launch", ["x"]);
	});

	it("emits nothing in a TUI session and still calls the original", () => {
		const { ui, original, emitted } = setup({ isRpc: false });
		ui.setWidget("subagent-async", ["PI_SUBAGENT_ASYNC_JSON:{}"]);
		expect(emitted).toEqual([]);
		expect(original).toHaveBeenCalledTimes(1);
	});

	it("emits a clear (undefined content) as an empty list", () => {
		const { ui, original, emitted } = setup();
		ui.setWidget("subagent-async", undefined);
		expect(emitted).toEqual([{ channel: "subagents:status", payload: { widget: "subagent-async", lines: [] } }]);
		expect(original).toHaveBeenCalledWith("subagent-async", undefined);
	});

	it("emits nothing for a component factory (not an array)", () => {
		const { ui, original, emitted } = setup();
		const factory = () => ({});
		ui.setWidget("subagent-async", factory);
		expect(emitted).toEqual([]);
		expect(original).toHaveBeenCalledWith("subagent-async", factory);
	});

	it("does not double-wrap when installed twice on the same ui object", () => {
		const { ui, emitted } = setup();
		wrapSubagentWidgetForward(ui, { isRpc: () => true, emit: (c, p) => emitted.push({ channel: c, payload: p }) });
		ui.setWidget("subagent-async", ["line"]);
		expect(emitted).toHaveLength(1);
	});
});

describe("isRpcLaunch (launch argv, not hasUI: pi reports hasUI=true in RPC mode)", () => {
	it("is true for --mode rpc", () => {
		expect(isRpcLaunch(["node", "cli.js", "--mode", "rpc", "--session", "x"])).toBe(true);
	});
	it("is true for --mode=rpc", () => {
		expect(isRpcLaunch(["node", "cli.js", "--mode=rpc"])).toBe(true);
	});
	it("is false for text or interactive launches", () => {
		expect(isRpcLaunch(["node", "cli.js", "--mode", "text"])).toBe(false);
		expect(isRpcLaunch(["node", "cli.js"])).toBe(false);
	});
	it("does not match a value that merely contains rpc", () => {
		expect(isRpcLaunch(["node", "cli.js", "--name", "rpc"])).toBe(false);
	});
});
