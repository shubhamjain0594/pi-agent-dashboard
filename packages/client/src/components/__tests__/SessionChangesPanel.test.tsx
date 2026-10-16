import type {
  FileDiffEntry,
  SessionDiffResponse,
} from "@blackbelt-technology/pi-dashboard-shared/diff-types.js";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionChangesPanel } from "../diff/SessionChangesPanel.js";
import { SessionDiffContext } from "../diff/SessionDiffContext.js";

vi.mock("../diff/DiffPanel.js", () => ({
  DiffPanel: ({
    file,
    sessionId,
    hideToolbar,
  }: {
    file: FileDiffEntry;
    sessionId: string;
    hideToolbar: boolean;
  }) => (
    <div data-testid="inline-diff" data-hide-toolbar={String(hideToolbar)}>
      {sessionId}:{file.path}
    </div>
  ),
}));
vi.mock("../editor-pane/EditorFileTree.js", () => ({
  EditorFileTree: ({
    changedFiles,
    onOpenFile,
    onOpenDiff,
    sessionOnly,
    treeOpenRoots,
  }: {
    changedFiles: FileDiffEntry[];
    onOpenFile: (path: string) => void;
    onOpenDiff: (path: string) => void;
    sessionOnly: boolean;
    treeOpenRoots: string[];
  }) => (
    <nav
      aria-label="Review tree"
      data-session-only={String(sessionOnly)}
      data-roots={treeOpenRoots.length}
    >
      {changedFiles.map((file) => (
        <div key={file.path}>
          <button type="button" onClick={() => onOpenFile(file.path)}>
            {file.path}
          </button>
          <button
            type="button"
            aria-label={`Tree diff ${file.path}`}
            onClick={() => onOpenDiff(file.path)}
          >
            Diff
          </button>
        </div>
      ))}
    </nav>
  ),
}));

afterEach(cleanup);
const data: SessionDiffResponse = {
  isGitRepo: true,
  baseLabel: "HEAD",
  totalAdditions: 4,
  totalDeletions: 2,
  files: [
    {
      path: "src/owned.ts",
      changes: [{ type: "write", timestamp: 1 }],
      additions: 4,
      deletions: 2,
    },
    { path: "src/second.ts", changes: [] },
  ],
  otherChanges: [{ path: "src/manual.ts", changes: [] }],
};

function setup(
  value: SessionDiffResponse | null = data,
  error: string | null = null,
  isLoading = false,
) {
  const onOpenDiff = vi.fn();
  const onOpenFile = vi.fn();
  const refresh = vi.fn();
  const view = (
    next: SessionDiffResponse | null,
    sessionId = "one",
    loading = false,
  ) => (
    <StrictMode>
      <SessionDiffContext.Provider
        value={{ sessionId, data: next, isLoading: loading, error, refresh }}
      >
        <SessionChangesPanel
          cwd="/workspace"
          onOpenDiff={onOpenDiff}
          onOpenFile={onOpenFile}
        />
      </SessionDiffContext.Provider>
    </StrictMode>
  );
  const result = render(view(value, "one", isLoading));
  return {
    onOpenDiff,
    onOpenFile,
    refresh,
    update: (
      next: SessionDiffResponse | null,
      sessionId = "one",
      loading = false,
    ) => result.rerender(view(next, sessionId, loading)),
  };
}

describe("SessionChangesPanel", () => {
  it("does not pre-mount heavy renderers for a large review", async () => {
    setup({
      ...data,
      files: Array.from({ length: 200 }, (_, index) => ({
        path: `src/file-${index}.ts`,
        changes: [],
      })),
    });
    await waitFor(() =>
      expect(screen.getAllByTestId("inline-diff")).toHaveLength(1),
    );
    expect(screen.getAllByTestId("session-review-file")).toHaveLength(200);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryAllByTestId("inline-diff")).toHaveLength(0);
  });
  it("mounts only the first diff and separates expand, source, and diff actions", async () => {
    const { onOpenDiff, onOpenFile } = setup();
    await waitFor(() =>
      expect(screen.getAllByTestId("inline-diff")).toHaveLength(1),
    );
    expect(screen.getByTestId("inline-diff").textContent).toBe(
      "one:src/owned.ts",
    );
    expect(
      screen.getByTestId("inline-diff").getAttribute("data-hide-toolbar"),
    ).toBe("true");
    fireEvent.click(screen.getAllByTestId("session-review-file")[1]);
    await waitFor(() =>
      expect(screen.getAllByTestId("inline-diff")).toHaveLength(2),
    );
    expect(onOpenDiff).not.toHaveBeenCalled();
    expect(onOpenFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByTestId("session-review-open-file")[0]);
    fireEvent.click(screen.getAllByTestId("session-review-open-diff")[0]);
    expect(onOpenFile).toHaveBeenCalledExactlyOnceWith("src/owned.ts");
    expect(onOpenDiff).toHaveBeenCalledExactlyOnceWith("src/owned.ts");
    expect(screen.queryByText("New")).toBeNull();
    expect(screen.getByText(/not an isolated per-agent snapshot/)).toBeTruthy();
  });
  it("selects and scrolls from the shared tree without opening source", async () => {
    const { onOpenFile, onOpenDiff } = setup();
    const tree = screen.getByRole("navigation");
    expect(tree.getAttribute("data-session-only")).toBe("true");
    expect(tree.getAttribute("data-roots")).toBe("0");
    const scroll = vi.fn();
    screen
      .getAllByTestId("session-review-file")[1]
      .closest("header")!.scrollIntoView = scroll;
    fireEvent.click(
      within(tree).getByRole("button", { name: "src/second.ts" }),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("inline-diff")).toHaveLength(2),
    );
    expect(scroll).toHaveBeenCalledExactlyOnceWith({
      block: "start",
      behavior: "auto",
    });
    expect(onOpenFile).not.toHaveBeenCalled();
    expect(onOpenDiff).not.toHaveBeenCalled();
    fireEvent.click(
      within(tree).getByRole("button", { name: "Tree diff src/second.ts" }),
    );
    expect(onOpenDiff).toHaveBeenCalledWith("src/second.ts");
  });
  it("filters headers and tree, restores on clear, and explicitly includes other edits", () => {
    setup();
    expect(
      screen.getByRole("checkbox", { name: "This session only" }),
    ).toHaveProperty("checked", true);
    expect(
      screen.getByText(/Other working-tree changes.*1.*excluded/),
    ).toBeTruthy();
    expect(screen.queryByText("src/manual.ts")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getAllByTestId("session-review-file")).toHaveLength(3);
    expect(screen.getByText("Not agent-owned")).toBeTruthy();
    const search = screen.getByRole("searchbox", {
      name: "Search changed files",
    });
    fireEvent.change(search, { target: { value: "MANUAL" } });
    expect(screen.getAllByTestId("session-review-file")).toHaveLength(1);
    expect(
      within(screen.getByRole("navigation")).getByText("src/manual.ts"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("navigation")).queryByText("src/owned.ts"),
    ).toBeNull();
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.queryAllByTestId("session-review-file")).toHaveLength(0);
    expect(
      screen.getByText("No changed files match your search."),
    ).toBeTruthy();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByTestId("session-review-file")).toHaveLength(3);
  });
  it("preserves collapse-all across refresh and prunes removed paths", async () => {
    const { update, refresh } = setup();
    await screen.findByTestId("inline-diff");
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByTestId("inline-diff")).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand all" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh changes" }));
    expect(refresh).toHaveBeenCalledOnce();
    update({ ...data, files: [...data.files] });
    expect(screen.queryByTestId("inline-diff")).toBeNull();
    fireEvent.click(screen.getAllByTestId("session-review-file")[1]);
    await screen.findByTestId("inline-diff");
    update({ ...data, files: [data.files[0]] });
    update(data);
    expect(screen.queryByTestId("inline-diff")).toBeNull();
  });
  it("initializes after loading and resets scope/search/expansion for another session", async () => {
    const { update } = setup(null, null, true);
    expect(screen.getByRole("status").textContent).toBe("Updating changes…");
    expect(
      screen.queryByText("No file changes attributed to this session yet."),
    ).toBeNull();
    update(data);
    await screen.findByTestId("inline-diff");
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "manual" },
    });
    update(data, "two");
    await waitFor(() =>
      expect(screen.getByTestId("inline-diff").textContent).toBe(
        "two:src/owned.ts",
      ),
    );
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "");
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", true);
  });
  it("keeps failure, unavailable, and successful empty states honest", () => {
    setup(null, "Connection failed");
    expect(screen.getByRole("alert").textContent).toBe("Connection failed");
    expect(
      screen.queryByText("No file changes attributed to this session yet."),
    ).toBeNull();
    cleanup();
    setup({ isGitRepo: false, files: [] });
    expect(
      screen.getByText("No file changes attributed to this session yet."),
    ).toBeTruthy();
    expect(screen.getByText(/No Git baseline/)).toBeTruthy();
    cleanup();
    render(
      <SessionChangesPanel
        cwd="/workspace"
        onOpenFile={vi.fn()}
        onOpenDiff={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Changes are unavailable for this session."),
    ).toBeTruthy();
  });
  it("disables unavailable/out-of-cwd/deleted source actions but allows diffs", () => {
    const { onOpenFile, onOpenDiff } = setup({
      ...data,
      files: [
        { ...data.files[0], previewable: false },
        { path: "/outside/file.ts", changes: [] },
        { path: "../escape.ts", changes: [] },
        {
          path: "deleted.ts",
          changes: [],
          gitDiff:
            "diff --git a/deleted.ts b/deleted.ts\ndeleted file mode 100644\n--- a/deleted.ts\n+++ /dev/null\n",
        },
        {
          path: "new.ts",
          changes: [],
          gitDiff:
            "diff --git a/new.ts b/new.ts\nnew file mode 100644\n--- /dev/null\n+++ b/new.ts\n",
        },
      ],
    });
    screen
      .getAllByTestId("session-review-open-file")
      .slice(0, 4)
      .forEach((button) => {
        expect(button).toHaveProperty("disabled", true);
        fireEvent.click(button);
      });
    expect(onOpenFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByTestId("session-review-open-diff")[0]);
    expect(onOpenDiff).toHaveBeenCalledWith("src/owned.ts");
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.getAllByTestId("session-review-file")[0]).toHaveProperty(
      "disabled",
      false,
    );
  });
});
