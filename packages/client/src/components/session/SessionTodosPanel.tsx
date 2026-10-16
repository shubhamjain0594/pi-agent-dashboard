import { useI18n } from "../../lib/i18n/i18n.js";
import type { SessionTodoSnapshot, SessionTodoTask } from "../../lib/session/session-todos.js";

interface Props {
  snapshot: SessionTodoSnapshot | null;
}

/** Display only: the installed Pi todo tool owns all task mutations. */
export function SessionTodosPanel({ snapshot }: Props) {
  const { t } = useI18n();
  const tasks = snapshot?.tasks.filter((task) => task.status !== "deleted") ?? [];
  const byId = new Map(snapshot?.tasks.map((task) => [task.id, task]));
  const active = tasks.filter((task) => task.status === "in_progress");
  const pending = tasks.filter((task) => task.status === "pending");
  const completed = tasks.filter((task) => task.status === "completed");

  function taskList(rows: SessionTodoTask[]) {
    return (
      <ul className="space-y-2">
        {rows.map((task) => {
          const blockers = task.blockedBy?.filter((id) => {
            const dependency = byId.get(id);
            return dependency?.status !== "completed" && dependency?.status !== "deleted";
          }) ?? [];
          return (
          <li key={task.id} className="min-w-0 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-1.5 break-words [overflow-wrap:anywhere]">
            <div className="flex items-start gap-2">
              <span aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]">{task.status === "completed" ? "✓" : task.status === "in_progress" ? "◉" : "○"}</span>
              <span className="whitespace-pre-wrap">{task.subject}</span>
              <span className="ml-auto shrink-0 text-[var(--text-tertiary)]">#{task.id}</span>
            </div>
            {task.status === "in_progress" && task.activeForm && <p className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{task.activeForm}</p>}
            {task.description && <p className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{task.description}</p>}
            {task.owner && <p className="mt-1 text-[var(--text-tertiary)]">Owner: {task.owner}</p>}
            {blockers.length > 0 && <p className="mt-1 text-[var(--text-tertiary)]">Blocked by: {blockers.slice(0, 8).map((id) => `#${id}${byId.has(id) ? ` ${byId.get(id)?.subject.slice(0, 120)}` : ""}`).join(", ")}{blockers.length > 8 ? ` · ${blockers.length - 8} more dependencies` : ""}</p>}
          </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section aria-label={t("tasks.sessionTodosAria", undefined, "Session todos")} className="min-w-0 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-primary)]">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-medium">{t("tasks.todos", undefined, "Todos")}</h2>
        <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[var(--text-secondary)]">Read-only</span>
      </header>
      {snapshot === null ? (
        <div className="space-y-1 text-[var(--text-secondary)]">
          <p>{t("tasks.noSnapshot", undefined, "No todo snapshot received yet.")}</p>
          <p>{t("tasks.noSnapshotHint", undefined, "The agent must use the installed todo tool to publish tasks here.")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[var(--text-secondary)]">{active.length} in progress · {pending.length} pending · {completed.length} completed</p>
          {tasks.length === 0 && <p className="text-[var(--text-secondary)]">{t("tasks.noTasks", undefined, "No tasks.")}</p>}
          {active.length > 0 && <div><h3 className="mb-1 font-medium">In progress ({active.length})</h3>{taskList(active)}</div>}
          {pending.length > 0 && <div><h3 className="mb-1 font-medium">Pending ({pending.length})</h3>{taskList(pending)}</div>}
          {completed.length > 0 && <details><summary className="cursor-pointer text-[var(--text-secondary)]">Completed ({completed.length})</summary><div className="mt-2">{taskList(completed)}</div></details>}
        </div>
      )}
    </section>
  );
}
