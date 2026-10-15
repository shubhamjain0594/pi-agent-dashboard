import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceExplorer } from "../WorkspaceExplorer.js";

afterEach(cleanup);
function setup() {
  const onSelect = vi.fn();
  const onSpawnSession = vi.fn();
  const onOpenFolder = vi.fn();
  render(
    <WorkspaceExplorer
      sessions={[
        {
          id: "one",
          cwd: "/work/app",
          name: "Build navigation",
          status: "idle",
          source: "dashboard",
          startedAt: 100,
        } as DashboardSession,
      ]}
      folders={["/work/app"]}
      selectedId="one"
      onSelect={onSelect}
      onOpenFolder={onOpenFolder}
      onSpawnSession={onSpawnSession}
      onAddFolder={vi.fn()}
    >
      <div>Full session controls</div>
    </WorkspaceExplorer>,
  );
  return { onSelect, onSpawnSession, onOpenFolder };
}

function renderSessions(sessions: DashboardSession[], selectedId?: string) {
  return render(
    <WorkspaceExplorer
      sessions={sessions}
      folders={["/work/app"]}
      selectedId={selectedId}
      onSelect={vi.fn()}
      onOpenFolder={vi.fn()}
      onSpawnSession={vi.fn()}
      onAddFolder={vi.fn()}
    >
      <div>Full session controls</div>
    </WorkspaceExplorer>,
  );
}

function endedSessions() {
  return Array.from(
    { length: 15 },
    (_, index) =>
      ({
        id: `ended-${index}`,
        name: `Past session ${index}`,
        cwd: "/work/app",
        status: "ended",
        source: "dashboard",
        startedAt: index,
        endedAt: index + 100,
      }) as DashboardSession,
  );
}

describe("WorkspaceExplorer", () => {
  it("sorts sessions by latest activity without mutating the supplied list", () => {
    const sessions = [
      { id: "old", name: "Old", startedAt: 1 },
      { id: "new", name: "New", startedAt: 10 },
      { id: "active", name: "Active", startedAt: 2, lastActivityAt: 20 },
    ].map(
      (session) =>
        ({
          cwd: "/work/app",
          status: "idle",
          source: "dashboard",
          ...session,
        }) as DashboardSession,
    );
    const { container } = renderSessions(sessions);
    expect(
      Array.from(container.querySelectorAll(".workspace-explorer-session")).map(
        (row) => row.getAttribute("title")?.split(" — ")[0],
      ),
    ).toEqual(["Active", "New", "Old"]);
    expect(sessions.map((session) => session.id)).toEqual([
      "old",
      "new",
      "active",
    ]);
  });

  it("previews the latest ten ended sessions and reveals all on demand", () => {
    const { container } = renderSessions(endedSessions());
    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(
      details.querySelectorAll(".workspace-explorer-session"),
    ).toHaveLength(10);
    expect(
      details
        .querySelector(".workspace-explorer-session")
        ?.getAttribute("title"),
    ).toContain("Past session 14");
    fireEvent.click(screen.getByRole("button", { name: /Show all/ }));
    expect(
      details.querySelectorAll(".workspace-explorer-session"),
    ).toHaveLength(15);
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(
      details.querySelectorAll(".workspace-explorer-session"),
    ).toHaveLength(10);
  });

  it("finds older ended sessions through search and keeps a selected older session visible", () => {
    const { container } = renderSessions(endedSessions(), "ended-0");
    expect(
      container.querySelector('[aria-current="page"]')?.textContent,
    ).toContain("Past session 0");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Past session" },
    });
    expect(
      container.querySelectorAll(".workspace-explorer-session"),
    ).toHaveLength(15);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Past session 0" },
    });
    expect(
      container.querySelectorAll(".workspace-explorer-session"),
    ).toHaveLength(1);
  });

  it("offers compact navigation, project opening and session creation", () => {
    const { onSelect, onSpawnSession, onOpenFolder } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Build navigation" }));
    expect(onSelect).toHaveBeenCalledWith("one");
    expect(
      screen
        .getByRole("button", { name: "Build navigation" })
        .getAttribute("aria-current"),
    ).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "app" }));
    expect(onOpenFolder).toHaveBeenCalledWith("/work/app");
    fireEvent.click(screen.getByRole("button", { name: "New session in app" }));
    expect(onSpawnSession).toHaveBeenCalledWith("/work/app");
  });

  it("filters sessions without displaying fabricated results", () => {
    setup();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "no match" },
    });
    expect(
      screen.queryByRole("button", { name: "Build navigation" }),
    ).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("No matching");
  });

  it("collapses projects and reveals matching sessions while searching", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Toggle project app" }));
    expect(
      screen.queryByRole("button", { name: "Build navigation" }),
    ).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "navigation" },
    });
    expect(
      screen.getByRole("button", { name: "Build navigation" }),
    ).toBeTruthy();
  });

  it("keeps all original controls reachable in detailed view", () => {
    setup();
    const controls = screen.getByText("Full session controls");
    expect(controls.parentElement?.style.display).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Detailed view" }));
    expect(screen.getByText("Full session controls")).toBeTruthy();
    expect(controls.parentElement?.style.display).not.toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Compact view" }));
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getByText("Full session controls")).toBe(controls);
  });

  it("preserves hidden-session filtering and switches to details for seek requests", () => {
    const props = {
      sessions: [
        {
          id: "hidden",
          cwd: "/work/secret",
          name: "Hidden work",
          hidden: true,
          status: "idle",
          source: "dashboard",
          startedAt: 100,
        } as DashboardSession,
      ],
      folders: [],
      onSelect: vi.fn(),
      onOpenFolder: vi.fn(),
      onSpawnSession: vi.fn(),
      onAddFolder: vi.fn(),
    };
    const { rerender } = render(
      <WorkspaceExplorer {...props}>
        <div>Controls</div>
      </WorkspaceExplorer>,
    );
    expect(screen.queryByRole("button", { name: "Hidden work" })).toBeNull();
    rerender(
      <WorkspaceExplorer
        {...props}
        revealRequest={{ sessionId: "hidden", nonce: 1 }}
      >
        <div>Controls</div>
      </WorkspaceExplorer>,
    );
    expect(screen.getByRole("button", { name: "Compact view" })).toBeTruthy();
    expect(screen.getByText("Controls").parentElement?.style.display).not.toBe(
      "none",
    );
  });
});
