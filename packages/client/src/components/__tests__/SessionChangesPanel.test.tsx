import type { SessionDiffResponse } from "@blackbelt-technology/pi-dashboard-shared/diff-types.js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionChangesPanel } from "../diff/SessionChangesPanel.js";
import { SessionDiffContext } from "../diff/SessionDiffContext.js";

afterEach(cleanup);
const data: SessionDiffResponse = {
  isGitRepo: true,
  baseLabel: "HEAD",
  totalAdditions: 4,
  totalDeletions: 2,
  files: [
    {
      path: "src/owned.ts",
      changes: [{ type: "edit", timestamp: 1 }],
      additions: 4,
      deletions: 2,
    },
  ],
  otherChanges: [{ path: "src/manual.ts", changes: [] }],
};

function setup(
  value: SessionDiffResponse | null = data,
  error: string | null = null,
) {
  const onOpenDiff = vi.fn();
  const refresh = vi.fn();
  render(
    <SessionDiffContext.Provider
      value={{
        sessionId: "one",
        data: value,
        isLoading: false,
        error,
        refresh,
      }}
    >
      <SessionChangesPanel onOpenDiff={onOpenDiff} />
    </SessionDiffContext.Provider>,
  );
  return { onOpenDiff, refresh };
}

describe("SessionChangesPanel", () => {
  it("opens only attributed changes and keeps other working-tree edits separate", () => {
    const { onOpenDiff } = setup();
    expect(screen.getAllByTestId("session-review-file")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("session-review-file"));
    expect(onOpenDiff).toHaveBeenCalledWith("src/owned.ts");
    expect(
      screen.getByText(/Other working-tree changes/).closest("details")?.open,
    ).toBe(false);
    expect(screen.getByText(/not an isolated per-agent snapshot/)).toBeTruthy();
  });
  it("refreshes through the shared session diff source", () => {
    const { refresh } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Refresh changes" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("does not treat failed retrieval as no changes", () => {
    setup(null, "Connection failed");
    expect(screen.getByRole("alert").textContent).toBe("Connection failed");
    expect(
      screen.queryByText("No file changes attributed to this session yet."),
    ).toBeNull();
  });
  it("offers a real empty state after a successful empty response", () => {
    setup({ isGitRepo: false, files: [] });
    expect(
      screen.getByText("No file changes attributed to this session yet."),
    ).toBeTruthy();
    expect(screen.getByText(/No Git baseline/)).toBeTruthy();
  });
  it("does not open previews the server marked unavailable", () => {
    const { onOpenDiff } = setup({
      ...data,
      files: [{ ...data.files[0], previewable: false }],
    });
    const file = screen.getByTestId("session-review-file") as HTMLButtonElement;
    expect(file.disabled).toBe(true);
    fireEvent.click(file);
    expect(onOpenDiff).not.toHaveBeenCalled();
  });
});
