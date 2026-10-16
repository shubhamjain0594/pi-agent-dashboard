/** SubagentInspectView: sends /subagents-inspect-rpc, shows the matching reply, and goes back. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubagentInspectView, buildInspectCommand } from "../SubagentInspectView.js";

afterEach(cleanup);

describe("buildInspectCommand", () => {
	it("builds the documented command with a child id", () => {
		expect(buildInspectCommand({ requestId: "rq_1", asyncId: "run-1", childId: "child-a", lines: 50 })).toBe(
			"/subagents-inspect-rpc rq_1 run-1 child-a --lines 50",
		);
	});
	it("omits the child id for a run", () => {
		expect(buildInspectCommand({ requestId: "rq_1", asyncId: "run-1", lines: 50 })).toBe("/subagents-inspect-rpc rq_1 run-1 --lines 50");
	});
});

describe("SubagentInspectView", () => {
	it("sends the inspect command on open", () => {
		const onSend = vi.fn((_text: string) => true);
		render(<SubagentInspectView asyncId="run-1" childId="child-a" replies={new Map()} onSend={onSend} onBack={() => {}} />);
		expect(onSend).toHaveBeenCalledTimes(1);
		expect(String(onSend.mock.calls[0][0])).toMatch(/^\/subagents-inspect-rpc \S+ run-1 child-a --lines \d+$/);
	});

	it("shows the task, transcript, and final output from the reply", () => {
		const onSend = vi.fn((_text: string) => true);
		const view = render(<SubagentInspectView asyncId="run-1" childId="child-a" replies={new Map()} onSend={onSend} onBack={() => {}} />);
		const requestId = String(onSend.mock.calls[0][0]).split(" ")[1];
		const reply = {
			kind: "pi-subagents.inspect-reply", version: 1, requestId, asyncId: "run-1", childId: "child-a",
			status: "done", task: "find sources", messages: [{ role: "assistant", kind: "text", text: "searching" }], finalOutput: "three sources",
		};
		view.rerender(<SubagentInspectView asyncId="run-1" childId="child-a" replies={new Map([[requestId, reply]]) as never} onSend={onSend} onBack={() => {}} />);
		expect(screen.getAllByText("find sources").length).toBeGreaterThan(0);
		expect(screen.getAllByText("searching").length).toBeGreaterThan(0);
		expect(screen.getAllByText("three sources").length).toBeGreaterThan(0);
		expect(screen.queryByTestId("inspect-waiting")).toBeNull();
	});

	it("shows a waiting note while no reply has arrived", () => {
		render(<SubagentInspectView asyncId="run-1" replies={new Map()} onSend={() => true} onBack={() => {}} />);
		expect(screen.getByTestId("inspect-waiting")).toBeDefined();
	});

	it("shows an error reply's message", () => {
		const onSend = vi.fn((_text: string) => true);
		const view = render(<SubagentInspectView asyncId="run-1" replies={new Map()} onSend={onSend} onBack={() => {}} />);
		const requestId = String(onSend.mock.calls[0][0]).split(" ")[1];
		const error = { kind: "pi-subagents.inspect-reply", version: 1, requestId, error: { code: "not_found", message: "Run not found." } };
		view.rerender(<SubagentInspectView asyncId="run-1" replies={new Map([[requestId, error]]) as never} onSend={onSend} onBack={() => {}} />);
		expect(screen.getByText("Run not found.")).toBeDefined();
	});

	it("goes back when the back button is pressed", () => {
		const onBack = vi.fn();
		render(<SubagentInspectView asyncId="run-1" replies={new Map()} onSend={() => true} onBack={onBack} />);
		fireEvent.click(screen.getByTestId("inspect-back"));
		expect(onBack).toHaveBeenCalledTimes(1);
	});
});
