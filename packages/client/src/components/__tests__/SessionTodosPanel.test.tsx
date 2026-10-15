import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SessionTodosPanel } from "../session/SessionTodosPanel.js";

afterEach(cleanup);

describe("SessionTodosPanel", () => {
  it("bounds repeated dependency subjects and discloses additional dependency counts", () => {
    const longSubject = "dependency".repeat(500);
    const view = render(<SessionTodosPanel snapshot={{ timestamp: 1, tasks: [
      { id: 1, subject: "Blocked task", status: "pending", blockedBy: Array.from({ length: 12 }, () => 2) },
      { id: 2, subject: longSubject, status: "pending" },
    ] }} />);
    const blockers = view.getByText(/^Blocked by:/).textContent ?? "";
    expect(blockers.length).toBeLessThan(1200);
    expect(blockers).toContain("4 more dependencies");
    expect(blockers).not.toContain(longSubject);
  });
  it("distinguishes missing snapshots from an authoritative empty list", () => {
    const view = render(<SessionTodosPanel snapshot={null} />);
    expect(view.getByText(/no todo snapshot received yet/i)).toBeTruthy();
    expect(view.getByText(/agent must use the installed todo tool/i)).toBeTruthy();
    expect(view.queryByText(/^No tasks\.$/)).toBeNull();
    view.rerender(<SessionTodosPanel snapshot={{ tasks: [], timestamp: 10 }} />);
    expect(view.getByText("No tasks.")).toBeTruthy();
    expect(view.queryByText(/snapshot received yet/i)).toBeNull();
  });

  it("groups visible tasks, preserves their order, and shows read-only metadata", () => {
    const view = render(<SessionTodosPanel snapshot={{ timestamp: 100, tasks: [
      { id: 9, subject: "Pending first", status: "pending", blockedBy: [2, 77], owner: "Ada" },
      { id: 2, subject: "Implement", status: "in_progress", activeForm: "Implementing", description: "Plain notes" },
      { id: 1, subject: "Pending second", status: "pending" },
      { id: 3, subject: "Shipped", status: "completed", description: "Verified" },
      { id: 4, subject: "Removed", status: "deleted" },
    ] }} />);
    expect(view.getByText("Read-only")).toBeTruthy();
    expect(view.getByText("1 in progress · 2 pending · 1 completed")).toBeTruthy();
    expect(view.getByText("Implementing")).toBeTruthy();
    expect(view.getByText("Owner: Ada")).toBeTruthy();
    expect(view.getByText(/Blocked by: #2 Implement, #77/)).toBeTruthy();
    expect(view.queryByText("Removed")).toBeNull();
    expect(view.queryByRole("checkbox")).toBeNull();
    expect(view.queryByRole("button")).toBeNull();
    const lists = view.getAllByRole("list");
    expect(within(lists[1]).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      expect.stringContaining("Pending first"), expect.stringContaining("Pending second"),
    ]);
    expect(view.container.querySelector("details summary")?.textContent).toBe("Completed (1)");
  });

  it("renders untrusted content as literal text without links or HTML", () => {
    const payload = '<img src=x onerror="alert(1)"> [link](https://example.com)';
    const view = render(<SessionTodosPanel snapshot={{ timestamp: 1, tasks: [
      { id: 1, subject: payload, description: payload, owner: payload, activeForm: payload, status: "pending" },
    ] }} />);
    expect(view.getAllByText(payload).length).toBeGreaterThan(0);
    expect(view.container.querySelector("img, a, input")).toBeNull();
  });

  it("shows no tasks when only deleted tasks remain", () => {
    const view = render(<SessionTodosPanel snapshot={{ timestamp: 1, tasks: [{ id: 1, subject: "Hidden", status: "deleted" }] }} />);
    expect(view.getByText("No tasks.")).toBeTruthy();
    expect(view.queryByText("Hidden")).toBeNull();
  });

  it("omits completed and deleted dependencies from blockers while retaining unknown IDs", () => {
    const view = render(<SessionTodosPanel snapshot={{ timestamp: 1, tasks: [
      { id: 1, subject: "Waiting", status: "pending", blockedBy: [2, 3, 4, 5, 77] },
      { id: 2, subject: "Finished dependency", status: "completed" },
      { id: 3, subject: "Deleted dependency", status: "deleted" },
      { id: 4, subject: "Pending dependency", status: "pending" },
      { id: 5, subject: "Active dependency", status: "in_progress" },
      { id: 6, subject: "Unblocked", status: "pending", blockedBy: [2, 3] },
    ] }} />);
    expect(view.getAllByText(/^Blocked by:/).map((row) => row.textContent)).toEqual([
      "Blocked by: #4 Pending dependency, #5 Active dependency, #77",
    ]);
    expect(view.queryByText("Deleted dependency")).toBeNull();
  });

  it("leaves scrolling to the inspector", () => {
    const view = render(<SessionTodosPanel snapshot={{ timestamp: 1, tasks: [] }} />);
    expect(view.container.querySelector('[class*="max-h-"], [class*="overflow-y-"]')).toBeNull();
  });
});
