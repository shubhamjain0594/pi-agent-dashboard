/** Header Tasks chip follows the rpiv-todo install gate (gate-rpiv-todo-on-install). */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SplitWorkspaceProvider } from "../../split/SplitWorkspaceContext.js";
import { SessionTasksChip } from "../SessionHeader.js";

afterEach(cleanup);

describe("SessionTasksChip", () => {
	it("is hidden when rpiv-todo is not installed", () => {
		render(
			<SplitWorkspaceProvider sessionId="chip-off" cwd="/proj" orientation="h" tasksEnabled={false}>
				<SessionTasksChip />
			</SplitWorkspaceProvider>,
		);
		expect(screen.queryByTestId("session-tasks-chip")).toBeNull();
	});

	it("is shown when rpiv-todo is installed", () => {
		render(
			<SplitWorkspaceProvider sessionId="chip-on" cwd="/proj" orientation="h" tasksEnabled={true}>
				<SessionTasksChip />
			</SplitWorkspaceProvider>,
		);
		expect(screen.getByTestId("session-tasks-chip")).toBeDefined();
	});
});
