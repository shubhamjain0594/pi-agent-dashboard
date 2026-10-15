import { mdiArrowRight, mdiRefresh } from "@mdi/js";
import Icon from "@mdi/react";
import { useI18n } from "../../lib/i18n/i18n.js";
import { CountBadges } from "../session/CountBadges.js";
import { useOptionalSessionDiff } from "./SessionDiffContext.js";

/** A review-first index of the shared diff; never stages, reverts, or commits. */
export function SessionChangesPanel({
  onOpenDiff,
}: {
  onOpenDiff: (path: string) => void;
}) {
  const { t } = useI18n();
  const diff = useOptionalSessionDiff();
  const files = diff?.data?.files ?? [];
  const others = diff?.data?.otherChanges ?? [];
  return (
    <section
      className="session-work-panel"
      aria-labelledby="session-changes-heading"
      data-testid="session-changes-panel"
    >
      <header className="session-work-heading">
        <div>
          <h2 id="session-changes-heading">
            {t("review.agentChanges", undefined, "Agent changes")}
          </h2>
          <p>
            {t(
              "review.source",
              undefined,
              "Files attributed to this session’s observed tool activity.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={diff?.refresh}
          disabled={!diff || diff.isLoading}
          aria-label={t("review.refresh", undefined, "Refresh changes")}
          title={t("review.refresh", undefined, "Refresh changes")}
        >
          <Icon path={mdiRefresh} size={0.7} />
        </button>
      </header>
      {diff?.isLoading && (
        <p role="status">
          {t("review.loading", undefined, "Updating changes…")}
        </p>
      )}
      {diff?.error && (
        <p role="alert" className="session-work-error">
          {diff.error}
        </p>
      )}
      {!diff && (
        <p role="status">
          {t(
            "review.unavailable",
            undefined,
            "Changes are unavailable for this session.",
          )}
        </p>
      )}
      {diff?.data && !diff.error && !diff.isLoading && files.length === 0 && (
        <p className="session-work-empty">
          {t(
            "review.empty",
            undefined,
            "No file changes attributed to this session yet.",
          )}
        </p>
      )}
      {files.length > 0 && !diff?.error && (
        <>
          <div className="session-work-summary">
            <span>
              {files.length} {t("common.files", undefined, "files")}
            </span>
            {(diff?.data?.totalAdditions != null ||
              diff?.data?.totalDeletions != null) && (
              <CountBadges
                additions={diff?.data?.totalAdditions ?? 0}
                deletions={diff?.data?.totalDeletions ?? 0}
              />
            )}
          </div>
          <ul className="session-work-files">
            {files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => onOpenDiff(file.path)}
                  disabled={file.previewable === false}
                  title={file.path}
                  data-testid="session-review-file"
                >
                  <span className="session-work-file-copy">
                    <strong>{file.path.split(/[\\/]/).pop()}</strong>
                    <small>{file.path}</small>
                    <small>
                      {file.previewable === false
                        ? t(
                            "review.outside",
                            undefined,
                            "Outside the workspace — preview unavailable",
                          )
                        : (file.producedBy ??
                          `${file.changes.length} ${t("review.recordedEdits", undefined, file.changes.length === 1 ? "recorded tool change" : "recorded tool changes")}`)}
                    </small>
                  </span>
                  {(file.additions != null || file.deletions != null) && (
                    <CountBadges
                      additions={file.additions ?? 0}
                      deletions={file.deletions ?? 0}
                    />
                  )}
                  <Icon path={mdiArrowRight} size={0.6} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {others.length > 0 && !diff?.error && (
        <details className="session-work-other">
          <summary>
            {t("review.other", undefined, "Other working-tree changes")} ·{" "}
            {others.length}
          </summary>
          <p>
            {t(
              "review.otherHint",
              undefined,
              "These files are not attributed to this agent. They may come from you or another session.",
            )}
          </p>
          <ul>
            {others.map((file) => (
              <li key={file.path}>{file.path}</li>
            ))}
          </ul>
        </details>
      )}
      {diff?.data && (
        <p className="session-work-note">
          {diff.data.isGitRepo
            ? t(
                "review.gitScope",
                { base: diff.data.baseLabel ?? "HEAD" },
                `Repository diffs are compared with ${diff.data.baseLabel ?? "HEAD"}. Other edits to the same file can be included; this is not an isolated per-agent snapshot.`,
              )
            : t(
                "review.noGitScope",
                undefined,
                "No Git baseline is available. Review uses the recorded tool changes.",
              )}
        </p>
      )}
    </section>
  );
}
