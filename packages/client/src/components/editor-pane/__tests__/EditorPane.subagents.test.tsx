/**
 * Tasks → Subagents sub-tab (rewrite-subagent-inspector-for-pi-subagents, tree UI).
 * The plugin's snapshot hook is mocked so this file only tests the sub-tab wiring.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const snapshot = { current: null as null | { runs: unknown[] } };
vi.mock("@blackbelt-technology/pi-dashboard-subagents-plugin/client/useSubagentData", () => ({
	useSubagentSnapshot: () => snapshot.current,
}));
vi.mock("@blackbelt-technology/pi-dashboard-subagents-plugin/client/SubagentsPanel", () => ({
	SubagentsPanel: ({ onOpen }: { onOpen: (runId: string, childId?: string) => void }) => (
		<button type="button" data-testid="fake-subagents-panel" onClick={() => onOpen("run-1", undefined)}>
			subagents panel
		</button>
	),
}));

import { SplitWorkspaceProvider } from "../../split/SplitWorkspaceContext.js";
import { EditorPane } from "../EditorPane.js";

afterEach(() => {
	cleanup();
	snapshot.current = null;
});

function renderTasks(onOpenSubagent = vi.fn()) {
	const view = render(
		<SplitWorkspaceProvider sessionId="sub-tab" cwd="/proj" orientation="h" openSubagent={onOpenSubagent}>
			<EditorPane />
		</SplitWorkspaceProvider>,
	);
	fireEvent.click(screen.getByTestId("inspector-tasks"));
	return view;
}

describe("EditorPane — Subagents sub-tab under Tasks", () => {
	it("hides the Subagents sub-tab when there are no runs", () => {
		renderTasks();
		expect(screen.queryByTestId("tasks-subtab-subagents")).toBeNull();
	});

	it("shows the Subagents sub-tab when a snapshot has runs", () => {
		snapshot.current = { runs: [{ id: "run-1" }] };
		renderTasks();
		expect(screen.getByTestId("tasks-subtab-subagents")).toBeDefined();
	});

	it("switches to the subagents panel and opens an item through the workspace", async () => {
		snapshot.current = { runs: [{ id: "run-1" }] };
		const onOpen = vi.fn();
		renderTasks(onOpen);
		fireEvent.click(screen.getByTestId("tasks-subtab-subagents"));
		fireEvent.click(await screen.findByTestId("fake-subagents-panel"));
		expect(onOpen).toHaveBeenCalledWith("run-1", undefined);
	});

	it("falls back to the todo panel when the runs disappear", async () => {
		snapshot.current = { runs: [{ id: "run-1" }] };
		const view = renderTasks();
		fireEvent.click(screen.getByTestId("tasks-subtab-subagents"));
		expect(await screen.findByTestId("fake-subagents-panel")).toBeDefined();
		snapshot.current = null;
		view.rerender(
			<SplitWorkspaceProvider sessionId="sub-tab" cwd="/proj" orientation="h" openSubagent={() => {}}>
				<EditorPane />
			</SplitWorkspaceProvider>,
		);
		expect(screen.queryByTestId("fake-subagents-panel")).toBeNull();
		expect(screen.queryByTestId("tasks-subtab-subagents")).toBeNull();
	});
});
