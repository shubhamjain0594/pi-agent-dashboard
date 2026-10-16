import type { ChatMessage } from "../chat/event-reducer.js";

export interface SessionTodoTask {
  id: number;
  subject: string;
  status: "pending" | "in_progress" | "completed" | "deleted";
  description?: string;
  activeForm?: string;
  blockedBy?: number[];
  owner?: string;
}

export interface SessionTodoSnapshot {
  tasks: SessionTodoTask[];
  /** Completion epoch milliseconds, or the message timestamp when unavailable. */
  timestamp: number;
}

/** npm name of pi's rpiv-todo extension, which emits the `todo` tool results. */
export const RPIV_TODO_PACKAGE = "@juicesharp/rpiv-todo";

// Reject whole snapshots above these limits: a partial list would falsely imply
// completeness. Bounds include deleted tasks and dependency references.
const MAX_TASKS = 500;
const MAX_TEXT_LENGTH = 8192;
const MAX_SNAPSHOT_TEXT = 128 * 1024;
const MAX_TOTAL_DEPENDENCIES = 5000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_TEXT_LENGTH;
}

function parseTask(value: unknown): SessionTodoTask | null {
  if (!record(value) || !validId(value.id) ||
    !text(value.subject) || !value.subject.trim() ||
    (value.status !== "pending" && value.status !== "in_progress" &&
      value.status !== "completed" && value.status !== "deleted")) return null;
  for (const key of ["description", "activeForm", "owner"] as const) {
    if (value[key] !== undefined && !text(value[key])) return null;
  }
  if (value.blockedBy !== undefined && (!Array.isArray(value.blockedBy) ||
    value.blockedBy.length > MAX_TASKS || !value.blockedBy.every(validId))) return null;

  return {
    id: value.id, subject: value.subject, status: value.status,
    ...(value.description !== undefined ? { description: value.description as string } : {}),
    ...(value.activeForm !== undefined ? { activeForm: value.activeForm as string } : {}),
    ...(value.owner !== undefined ? { owner: value.owner as string } : {}),
    ...(value.blockedBy !== undefined ? { blockedBy: [...value.blockedBy as number[]] } : {}),
  };
}

function parseTasks(details: unknown): SessionTodoTask[] | null {
  if (!record(details) || details.error != null || details.resultMissing === true ||
    !text(details.action) || !details.action.trim() || !record(details.params) ||
    !validId(details.nextId) || !Array.isArray(details.tasks) || details.tasks.length > MAX_TASKS) return null;

  const tasks: SessionTodoTask[] = [];
  const ids = new Set<number>();
  let textLength = 0;
  let dependencyCount = 0;
  for (const value of details.tasks) {
    const task = parseTask(value);
    if (!task || ids.has(task.id)) return null;
    textLength += task.subject.length + (task.description?.length ?? 0) + (task.activeForm?.length ?? 0) + (task.owner?.length ?? 0);
    dependencyCount += task.blockedBy?.length ?? 0;
    if (textLength > MAX_SNAPSHOT_TEXT || dependencyCount > MAX_TOTAL_DEPENDENCIES) return null;
    ids.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

function validTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Pure projection. The caller MUST supply only the viewed session's messages. */
export function selectSessionTodos(messages: readonly ChatMessage[]): SessionTodoSnapshot | null {
  let latest: SessionTodoSnapshot | null = null;
  for (const message of messages) {
    // An elided middle may contain mutations; only the loaded tail can restore
    // an authoritative snapshot, regardless of the head's completion times.
    if (message.role === "historyGap") {
      latest = null;
      continue;
    }
    if (message.role !== "toolResult" || message.toolName !== "todo" ||
      message.toolStatus !== "complete" || message.isStreaming || !validTime(message.timestamp)) continue;
    const timestamp = validTime(message.startedAt) && validTime(message.duration)
      ? message.startedAt + message.duration : message.timestamp;
    if (!validTime(timestamp) || (latest && timestamp < latest.timestamp)) continue;
    const tasks = parseTasks(message.toolDetails);
    if (tasks !== null) latest = { tasks, timestamp };
  }
  return latest;
}
