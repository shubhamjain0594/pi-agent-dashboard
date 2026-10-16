/** SubagentTree: runs are folders, children nest, expand/collapse, open with (runId, childId). */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubagentTree } from "../SubagentTree.js";

afterEach(cleanup);

const nodes = [
	{
		id: "run-1",
		label: "research team",
		state: "running",
		children: [
			{ id: "child-a", label: "scout", state: "done" },
			{ id: "child-b", label: "writer", state: "running", children: [{ id: "grandchild", label: "fact-check", state: "queued" }] },
		],
	},
];

describe("SubagentTree", () => {
	it("shows runs at the top level and hides children until expanded", () => {
		render(<SubagentTree nodes={nodes} onOpen={() => {}} />);
		expect(screen.getByText("research team")).toBeDefined();
		expect(screen.queryByText("scout")).toBeNull();
	});

	it("expands a run to show its children, like a folder", () => {
		render(<SubagentTree nodes={nodes} onOpen={() => {}} />);
		fireEvent.click(screen.getByTestId("tree-toggle-run-1"));
		expect(screen.getByText("scout")).toBeDefined();
		expect(screen.getByText("writer")).toBeDefined();
	});

	it("nests grandchildren under their parent", () => {
		render(<SubagentTree nodes={nodes} onOpen={() => {}} />);
		fireEvent.click(screen.getByTestId("tree-toggle-run-1"));
		expect(screen.queryByText("fact-check")).toBeNull();
		fireEvent.click(screen.getByTestId("tree-toggle-child-b"));
		expect(screen.getByText("fact-check")).toBeDefined();
	});

	it("opens a child with the run id and the child id", () => {
		const onOpen = vi.fn();
		render(<SubagentTree nodes={nodes} onOpen={onOpen} />);
		fireEvent.click(screen.getByTestId("tree-toggle-run-1"));
		fireEvent.click(screen.getByText("scout"));
		expect(onOpen).toHaveBeenCalledWith("run-1", "child-a");
	});

	it("opens a run itself with only its id", () => {
		const onOpen = vi.fn();
		render(<SubagentTree nodes={nodes} onOpen={onOpen} />);
		fireEvent.click(screen.getByText("research team"));
		expect(onOpen).toHaveBeenCalledWith("run-1", undefined);
	});

	it("marks a finished run as closed, so it stays visible after pi clears its widget", () => {
		render(<SubagentTree nodes={[{ id: "run-9", label: "done team", state: "running", ended: true }]} onOpen={() => {}} />);
		expect(screen.getByText("done team")).toBeDefined();
		expect(screen.getByText("closed")).toBeDefined();
	});
});
