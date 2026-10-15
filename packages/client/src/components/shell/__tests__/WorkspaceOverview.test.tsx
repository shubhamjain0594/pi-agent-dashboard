import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceOverview } from "../WorkspaceOverview.js";

afterEach(cleanup);

const sessions = [
  {
    id: "one",
    name: "Build navigation",
    cwd: "/work/app",
    source: "dashboard",
    status: "streaming",
    startedAt: 200,
    gitBranch: "feat/navigation",
  },
  {
    id: "two",
    name: "Review API",
    cwd: "/work/api",
    source: "dashboard",
    status: "idle",
    startedAt: 100,
    awaitingFileAccess: true,
  },
  {
    id: "three",
    name: "Old session",
    cwd: "/work/app",
    source: "dashboard",
    status: "ended",
    startedAt: 50,
  },
] as DashboardSession[];

describe("WorkspaceOverview", () => {
  it("summarizes real sessions and prioritizes those needing attention", () => {
    render(
      <WorkspaceOverview
        sessions={sessions}
        folders={["/work/app"]}
        onSelect={vi.fn()}
        onOpenFolder={vi.fn()}
        onAddFolder={vi.fn()}
      />,
    );
    const rows = screen.getAllByTestId("overview-session");
    expect(rows[0].textContent).toContain("Review API");
    expect(screen.getByText("Needs you")).toBeTruthy();
    expect(screen.getByText("Working")).toBeTruthy();
    expect(screen.queryByText("Old session")).toBeNull();
  });

  it("opens sessions, deduplicates projects, and keeps add-project reachable", () => {
    const onSelect = vi.fn();
    const onOpenFolder = vi.fn();
    const onAddFolder = vi.fn();
    render(
      <WorkspaceOverview
        sessions={sessions}
        folders={["/work/app"]}
        onSelect={onSelect}
        onOpenFolder={onOpenFolder}
        onAddFolder={onAddFolder}
      />,
    );
    fireEvent.click(screen.getByText("Build navigation"));
    expect(onSelect).toHaveBeenCalledWith("one");
    expect(screen.getAllByTestId("overview-project")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Open app/ }));
    expect(onOpenFolder).toHaveBeenCalledWith("/work/app");
    fireEvent.click(screen.getByRole("button", { name: /Add project/ }));
    expect(onAddFolder).toHaveBeenCalledOnce();
  });

  it("offers an honest empty state when all sessions have ended", () => {
    render(
      <WorkspaceOverview
        sessions={[sessions[2]]}
        folders={[]}
        onSelect={vi.fn()}
        onOpenFolder={vi.fn()}
        onAddFolder={vi.fn()}
      />,
    );
    expect(screen.getByText("Your next idea starts here.")).toBeTruthy();
    expect(screen.queryAllByTestId("overview-session")).toHaveLength(0);
  });
});
