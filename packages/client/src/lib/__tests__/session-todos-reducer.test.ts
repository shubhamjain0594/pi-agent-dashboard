import { describe, expect, it } from "vitest";
import { createInitialState, reduceEvent } from "../chat/event-reducer.js";
import { selectSessionTodos } from "../session/session-todos.js";

describe("Pi todo snapshot transport integration", () => {
  it("projects a real structured todo tool result and honors later clear", () => {
    let state = createInitialState();
    const tasks = [{ id: 1, subject: "Review changes", status: "in_progress" }];
    state = reduceEvent(state, {
      eventType: "tool_execution_start",
      timestamp: 100,
      data: {
        toolCallId: "todo-one",
        toolName: "todo",
        args: { action: "create", subject: "Review changes" },
      },
    });
    expect(selectSessionTodos(state.messages)).toBeNull();
    // The existing bridge lifts result.details to data.details, exactly like replay.
    state = reduceEvent(state, {
      eventType: "tool_execution_end",
      timestamp: 120,
      data: {
        toolCallId: "todo-one",
        toolName: "todo",
        result: "Created #1",
        details: { action: "create", params: {}, tasks, nextId: 2 },
      },
    });
    expect(selectSessionTodos(state.messages)?.tasks).toEqual(tasks);
    state = reduceEvent(state, {
      eventType: "tool_execution_start",
      timestamp: 130,
      data: {
        toolCallId: "todo-clear",
        toolName: "todo",
        args: { action: "clear" },
      },
    });
    state = reduceEvent(state, {
      eventType: "tool_execution_end",
      timestamp: 140,
      data: {
        toolCallId: "todo-clear",
        toolName: "todo",
        result: "Cleared",
        details: { action: "clear", params: {}, tasks: [], nextId: 2 },
      },
    });
    expect(selectSessionTodos(state.messages)?.tasks).toEqual([]);
  });
});
