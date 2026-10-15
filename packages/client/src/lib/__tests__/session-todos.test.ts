import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../chat/event-reducer.js";
import { selectSessionTodos } from "../session/session-todos.js";

const task = { id: 1, subject: "First", status: "pending" };
function message(tasks: unknown = [task], overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "result", role: "toolResult", content: "", toolName: "todo",
    toolStatus: "complete", timestamp: 100,
    toolDetails: { action: "list", params: {}, tasks, nextId: 2 }, ...overrides,
  };
}

describe("selectSessionTodos", () => {
  it("rejects aggregate text and dependency budgets rather than rendering partial state", () => {
    const textHeavy = Array.from({ length: 32 }, (_, index) => ({ ...task, id: index + 1, subject: "x".repeat(8192) }));
    expect(selectSessionTodos([message(textHeavy)])).toBeNull();
    const graphHeavy = Array.from({ length: 20 }, (_, index) => ({ ...task, id: index + 1, blockedBy: Array.from({ length: 300 }, (_, id) => id + 1) }));
    expect(selectSessionTodos([message(graphHeavy)])).toBeNull();
  });
  it("copies a valid snapshot without sorting IDs or dropping deleted tasks", () => {
    const tasks = [{ ...task, id: 9, blockedBy: [2], owner: "Ada", activeForm: "Working", description: "Notes" }, { ...task, id: 2, status: "deleted" }];
    const snapshot = selectSessionTodos([message(tasks)]);
    expect(snapshot).toEqual({ tasks, timestamp: 100 });
    expect(snapshot?.tasks).not.toBe(tasks);
    expect(snapshot?.tasks[0].blockedBy).not.toBe("blockedBy" in tasks[0] ? tasks[0].blockedBy : undefined);
  });

  it("treats an empty result as an authoritative clear", () => {
    expect(selectSessionTodos([message(), message([], { timestamp: 200 })])).toEqual({ tasks: [], timestamp: 200 });
    expect(selectSessionTodos([])).toBeNull();
  });

  it.each([
    { role: "user" }, { role: "assistant" }, { toolName: "TodoWrite" },
    { toolStatus: "running" }, { toolStatus: "error" }, { toolStatus: "elided" },
    { toolStatus: undefined }, { isStreaming: true }, { toolDetails: undefined },
    { toolDetails: { action: "list", params: {}, tasks: [], nextId: 2, error: "failed" } },
    { toolDetails: { action: "list", params: {}, tasks: [], nextId: 2, resultMissing: true } },
  ] satisfies Partial<ChatMessage>[])("ignores text, args, partial and failed results: %j", (overrides) => {
    expect(selectSessionTodos([message(), message([], { timestamp: 200, content: JSON.stringify({ tasks: [] }), args: { tasks: [] }, ...overrides })])?.tasks).toEqual([task]);
    expect(selectSessionTodos([message([], overrides)])).toBeNull();
  });

  it("selects by completion time, not start position or ID", () => {
    expect(selectSessionTodos([
      message([task], { timestamp: 10, startedAt: 10, duration: 100 }),
      message([], { timestamp: 20, startedAt: 20, duration: 30 }),
    ])).toEqual({ tasks: [task], timestamp: 110 });
    expect(selectSessionTodos([message([], { timestamp: 200 }), message([task], { timestamp: 100 })])?.tasks).toEqual([]);
    expect(selectSessionTodos([message(), message([])])?.tasks).toEqual([]);
  });

  it("has no cache across caller-selected sessions", () => {
    expect(selectSessionTodos([message()])?.tasks).toHaveLength(1);
    expect(selectSessionTodos([])).toBeNull();
    expect(selectSessionTodos([message([])])?.tasks).toEqual([]);
  });

  it("discards snapshots before a history gap even when the tail contains other results", () => {
    const gap: ChatMessage = { id: "gap", role: "historyGap", content: "Elided middle", timestamp: 200 };
    expect(selectSessionTodos([message(), gap])).toBeNull();
    expect(selectSessionTodos([
      message(), gap, message([], { toolStatus: "running", timestamp: 300 }),
      message([], { toolStatus: "error", timestamp: 400 }),
      message([], { toolDetails: { tasks: [] }, timestamp: 500 }),
    ])).toBeNull();
  });

  it("recovers from a gap only with a valid tail snapshot, including an empty clear", () => {
    const gap: ChatMessage = { id: "gap", role: "historyGap", content: "", timestamp: 200 };
    const head = message([task], { startedAt: 100, duration: 1000 });
    const tailTasks = [{ ...task, subject: "Tail" }];
    expect(selectSessionTodos([head, gap, message(tailTasks, { timestamp: 300 })])).toEqual({ tasks: tailTasks, timestamp: 300 });
    expect(selectSessionTodos([head, gap, message([], { timestamp: 300 })])).toEqual({ tasks: [], timestamp: 300 });
    expect(selectSessionTodos([head, gap, message(tailTasks), gap])).toBeNull();
  });

  it.each([
    null, {}, "tasks", [null], [{ ...task, id: -1 }], [{ ...task, id: 1.5 }],
    [{ ...task, id: NaN }], [{ ...task, id: "1" }], [{ ...task, subject: " " }],
    [{ ...task, status: "done" }], [task, task], [{ ...task, owner: {} }],
    [{ ...task, blockedBy: ["2"] }], [{ ...task, description: 42 }],
    [{ ...task, activeForm: false }], [{ ...task, subject: "a".repeat(20_000) }],
    Array.from({ length: 501 }, (_, id) => ({ ...task, id: id + 1 })),
  ].map((tasks) => ({ tasks })))("rejects an entire malformed or oversized snapshot ($tasks)", ({ tasks }) => {
    expect(selectSessionTodos([message(tasks)])).toBeNull();
    expect(selectSessionTodos([message(), message(tasks, { timestamp: 200 })])?.tasks).toEqual([task]);
  });

  it("rejects incomplete envelopes and unusable times", () => {
    expect(selectSessionTodos([message([], { toolDetails: { tasks: [] } })])).toBeNull();
    expect(selectSessionTodos([message([], { timestamp: NaN })])).toBeNull();
  });

  it("accepts the bounded maximum without truncating, but rejects excess dependencies", () => {
    const tasks = Array.from({ length: 500 }, (_, index) => ({ ...task, id: index + 1 }));
    expect(selectSessionTodos([message(tasks)])?.tasks).toHaveLength(500);
    expect(selectSessionTodos([message([{ ...task, blockedBy: Array(501).fill(2) }])])).toBeNull();
  });

  it("uses message time without full timing metadata and never mutates inputs", () => {
    const frozen = Object.freeze([Object.freeze({ ...task, blockedBy: Object.freeze([2]) })]);
    const row = Object.freeze(message(frozen, { startedAt: 1 }));
    expect(selectSessionTodos(Object.freeze([row]))).toEqual({ tasks: frozen, timestamp: 100 });
    expect(selectSessionTodos([message([], { startedAt: 1, duration: -1 })])?.timestamp).toBe(100);
  });
});
