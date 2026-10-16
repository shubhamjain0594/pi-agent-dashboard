import type {
  FileDiffEntry,
  SessionDiffResponse,
} from "@blackbelt-technology/pi-dashboard-shared/diff-types.js";
import {
  mdiChevronDown,
  mdiChevronRight,
  mdiCodeBraces,
  mdiFileOutline,
  mdiRefresh,
} from "@mdi/js";
import { Icon } from "@mdi/react";
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../lib/i18n/i18n.js";
import { fileIcon } from "../../lib/preview/file-icon.js";
import { EditorFileTree } from "../editor-pane/EditorFileTree.js";
import { ErrorBoundary } from "../primitives/ErrorBoundary.js";
import { CountBadges } from "../session/CountBadges.js";
import {
  type SessionDiffContextValue,
  useOptionalSessionDiff,
} from "./SessionDiffContext.js";

const DiffPanel = lazy(() =>
  import("./DiffPanel.js").then((module) => ({ default: module.DiffPanel })),
);
const noToggleRoot = () => {};
const closedRoots: string[] = [];

interface ReviewProps {
  cwd: string;
  onOpenFile: (path: string) => void;
  onOpenDiff: (path: string) => void;
}

/** Review UI state is session-local even when a caller forgets to key its mount. */
export function SessionChangesPanel(props: ReviewProps) {
  const diff = useOptionalSessionDiff();
  return (
    <SessionChangeReview
      key={diff?.sessionId ?? "unavailable"}
      {...props}
      diff={diff}
    />
  );
}

function gitStatus(file: FileDiffEntry) {
  if (
    /^deleted file mode \d+\r?$/m.test(file.gitDiff ?? "") ||
    /^\+\+\+ \/dev\/null\r?$/m.test(file.gitDiff ?? "")
  )
    return "Deleted";
  if (
    /^new file mode \d+\r?$/m.test(file.gitDiff ?? "") ||
    /^--- \/dev\/null\r?$/m.test(file.gitDiff ?? "")
  )
    return "New";
  return null;
}

function sourceUnavailable(file: FileDiffEntry, cwd: string) {
  return (
    !cwd ||
    file.previewable === false ||
    gitStatus(file) === "Deleted" ||
    /^(?:[/\\]|[A-Za-z]:)/.test(file.path) ||
    file.path.split(/[/\\]/).includes("..")
  );
}

function SessionChangeReview({
  cwd,
  onOpenFile,
  onOpenDiff,
  diff,
}: ReviewProps & { diff: SessionDiffContextValue | null }) {
  const { t } = useI18n();
  const id = useId();
  const [sessionOnly, setSessionOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const initialized = useRef(false);
  const headers = useRef(new Map<string, HTMLElement>());
  const data = diff?.data;
  const allFiles = useMemo(() => {
    const files = new Map<string, FileDiffEntry>();
    for (const file of data?.files ?? []) files.set(file.path, file);
    for (const file of data?.otherChanges ?? []) {
      if (!files.has(file.path))
        files.set(file.path, { ...file, sessionOwned: false });
    }
    return [...files.values()];
  }, [data]);
  const scopedFiles = allFiles.filter(
    (file) => !sessionOnly || file.sessionOwned !== false,
  );
  const visibleFiles = scopedFiles.filter((file) =>
    file.path.toLowerCase().includes(search.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!data) return;
    const paths = new Set(allFiles.map((file) => file.path));
    if (!initialized.current && data.files.length > 0) {
      initialized.current = true;
      setExpanded(new Set([data.files[0].path]));
      setActivePath(data.files[0].path);
    } else
      setExpanded((previous) => {
        const next = new Set([...previous].filter((path) => paths.has(path)));
        return next.size === previous.size ? previous : next;
      });
    setActivePath((previous) =>
      previous && paths.has(previous) ? previous : null,
    );
  }, [data, allFiles]);

  const selectReview = (path: string) => {
    setActivePath(path);
    setExpanded((previous) => new Set(previous).add(path));
    headers.current
      .get(path)
      ?.scrollIntoView?.({ block: "start", behavior: "auto" });
  };
  const toggle = (path: string) => {
    setActivePath(path);
    initialized.current = true;
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <section
      className="session-change-review"
      aria-labelledby={`${id}-heading`}
      data-testid="session-changes-panel"
    >
      <header className="review-toolbar">
        <h2 id={`${id}-heading`}>
          {sessionOnly ? t("review.agentChanges", undefined, "Agent changes") : t("review.workingTreeChanges", undefined, "Working-tree changes")}
        </h2>
        {data && (
          <span>
            {scopedFiles.length} {t("common.files", undefined, "files")}
          </span>
        )}
        {scopedFiles.some(
          (file) => file.additions != null || file.deletions != null,
        ) && (
          <CountBadges
            additions={scopedFiles.reduce(
              (sum, file) => sum + (file.additions ?? 0),
              0,
            )}
            deletions={scopedFiles.reduce(
              (sum, file) => sum + (file.deletions ?? 0),
              0,
            )}
          />
        )}
        <label className="review-scope">
          <input
            type="checkbox"
            checked={sessionOnly}
            onChange={(event) => setSessionOnly(event.target.checked)}
          />
          This session only
        </label>
        <button
          type="button"
          onClick={() => {
            initialized.current = true;
            setExpanded(new Set());
          }}
          disabled={expanded.size === 0}
        >
          Collapse all
        </button>
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
        <p role="status" className="review-status">
          {t("review.loading", undefined, "Updating changes…")}
        </p>
      )}
      {diff?.error && (
        <p role="alert" className="review-status review-error">
          {diff.error}
        </p>
      )}
      {(!diff || (!data && !diff.isLoading && !diff.error)) && (
        <p role="status" className="review-status">
          {t(
            "review.unavailable",
            undefined,
            "Changes are unavailable for this session.",
          )}
        </p>
      )}
      {data && !diff?.error && (
        <div className="review-body">
          <div className="review-diffs" aria-label={t("review.fileDiffs", undefined, "File diffs")}>
            {!diff?.isLoading && visibleFiles.length === 0 && (
              <p className="review-status">
                {search.trim()
                  ? "No changed files match your search."
                  : t(
                      "review.empty",
                      undefined,
                      "No file changes attributed to this session yet.",
                    )}
              </p>
            )}
            {visibleFiles.map((file, index) => {
              const open = expanded.has(file.path);
              const icon = fileIcon(file.path);
              const name = file.path.split(/[\\/]/).pop() ?? file.path;
              const directory = file.path.slice(0, -name.length);
              const status = gitStatus(file);
              const unavailable = sourceUnavailable(file, cwd);
              const bodyId = `${id}-diff-${index}`;
              return (
                <section
                  className="review-file"
                  key={file.path}
                  data-active={activePath === file.path}
                >
                  <header
                    className="review-file-header"
                    ref={(node) => {
                      if (node) headers.current.set(file.path, node);
                      else headers.current.delete(file.path);
                    }}
                  >
                    <button
                      type="button"
                      className="review-file-toggle"
                      data-testid="session-review-file"
                      title={file.path}
                      aria-label={file.path}
                      aria-expanded={open}
                      aria-controls={bodyId}
                      onClick={() => toggle(file.path)}
                    >
                      <Icon
                        path={open ? mdiChevronDown : mdiChevronRight}
                        size={0.6}
                      />
                      <Icon
                        path={icon.iconPath}
                        className={icon.colorClass}
                        size={0.7}
                      />
                      <span className="review-file-path">
                        {directory && <span className="review-file-directory">{directory}</span>}
                        <span className="review-file-name">{name}</span>
                      </span>
                    </button>
                    {status && (
                      <span className="review-file-status">{status}</span>
                    )}
                    {file.sessionOwned === false && (
                      <span className="review-file-status">
                        Not agent-owned
                      </span>
                    )}
                    {(file.additions != null || file.deletions != null) && (
                      <CountBadges
                        additions={file.additions ?? 0}
                        deletions={file.deletions ?? 0}
                      />
                    )}
                    <button
                      type="button"
                      data-testid="session-review-open-file"
                      disabled={unavailable}
                      aria-label={`Open file in editor: ${file.path}`}
                      title={
                        unavailable
                          ? "File unavailable — outside workspace, deleted, or not previewable"
                          : "Open file in editor"
                      }
                      onClick={() => onOpenFile(file.path)}
                    >
                      <Icon path={mdiFileOutline} size={0.65} />
                    </button>
                    <button
                      type="button"
                      data-testid="session-review-open-diff"
                      aria-label={`Open diff in editor: ${file.path}`}
                      title={t("review.openDiffInEditor", undefined, "Open diff in editor")}
                      onClick={() => onOpenDiff(file.path)}
                    >
                      <Icon path={mdiCodeBraces} size={0.65} />
                    </button>
                  </header>
                  {open && (
                    <div id={bodyId} className="review-inline-diff">
                      {file.producedBy && (
                        <p className="review-status">{file.producedBy}</p>
                      )}
                      <ErrorBoundary
                        fallback={
                          <p
                            role="alert"
                            className="review-status review-error"
                          >
                            Unable to load this diff. Open source or diff in
                            editor using the file header.
                          </p>
                        }
                      >
                        <Suspense
                          fallback={
                            <p role="status" className="review-status">
                              Loading diff…
                            </p>
                          }
                        >
                          <DiffPanel
                            hideToolbar
                            file={file}
                            selection={{
                              filePath: file.path,
                              changeIndex: null,
                            }}
                            sessionId={diff!.sessionId}
                            cwd={cwd}
                          />
                        </Suspense>
                      </ErrorBoundary>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <aside className="review-sidebar" aria-label={t("review.changedFilesAria", undefined, "Changed files")}>
            <input
              type="search"
              aria-label={t("review.searchChangedFilesAria", undefined, "Search changed files")}
              placeholder={t("review.searchChangedFiles", undefined, "Search changed files…")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="review-tree-scroll">
              <EditorFileTree
                cwd={cwd}
                changedFiles={visibleFiles}
                sessionOnly={true}
                treeOpenRoots={closedRoots}
                onToggleRoot={noToggleRoot}
                activePath={activePath}
                onOpenFile={selectReview}
                onOpenDiff={onOpenDiff}
              />
            </div>
          </aside>
        </div>
      )}
      <ReviewDisclosure data={data} sessionOnly={sessionOnly} />
    </section>
  );
}

function ReviewDisclosure({
  data,
  sessionOnly,
}: {
  data: SessionDiffResponse | null | undefined;
  sessionOnly: boolean;
}) {
  const { t } = useI18n();
  const othersCount = data?.otherChanges?.length ?? 0;
  return (
    <footer className="review-footer">
      <details className="review-disclosure">
        <summary>Source &amp; baseline</summary>
        <p>
          {t(
            "review.source",
            undefined,
            "Files attributed to this session’s observed tool activity.",
          )}
        </p>
        {data && (
          <p>
            {data.isGitRepo
              ? t(
                  "review.gitScope",
                  { base: data.baseLabel ?? "HEAD" },
                  `Repository diffs are compared with ${data.baseLabel ?? "HEAD"}. Other edits to the same file can be included; this is not an isolated per-agent snapshot.`,
                )
              : t(
                  "review.noGitScope",
                  undefined,
                  "No Git baseline is available. Review uses the recorded tool changes.",
                )}
          </p>
        )}
      </details>
      {othersCount > 0 && (
        <p
          className="review-other-note"
          title={t("review.sharedFilesHint", undefined, "These files may come from you or another session.")}
        >
          Other working-tree changes · {othersCount}{" "}
          {sessionOnly ? "excluded" : "included — not agent-owned"}
        </p>
      )}
    </footer>
  );
}
