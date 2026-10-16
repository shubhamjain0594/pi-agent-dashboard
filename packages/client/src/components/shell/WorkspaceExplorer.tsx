import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import {
  mdiChevronDown,
  mdiChevronRight,
  mdiClose,
  mdiCodeBraces,
  mdiFolderOutline,
  mdiLoading,
  mdiMagnify,
  mdiPlus,
  mdiTuneVariant,
} from "@mdi/js";
import { Icon } from "@mdi/react";
import { type ReactNode, useState } from "react";
import { useI18n } from "../../lib/i18n/i18n.js";
import { selectBadgeTimestamp } from "../../lib/session/session-card-time.js";
import { getSessionDisplayName } from "../../lib/session/session-display-name.js";
import {
  folderName,
  sessionLabel,
} from "./WorkspaceOverview.js";

interface Props {
  children: ReactNode;
  sessions: DashboardSession[];
  folders: string[];
  selectedId?: string;
  revealRequest?: { sessionId: string; nonce: number } | null;
  onSelect: (id: string) => void;
  onOpenFolder: (cwd: string) => void;
  onAddFolder: () => void;
  onSpawnSession: (cwd: string) => void;
  onShutdownSession?: (sessionId: string) => void;
}

/** A navigation-first view; the original operational sidebar remains one click away. */
export function WorkspaceExplorer({
  children,
  sessions,
  folders,
  selectedId,
  revealRequest,
  onSelect,
  onOpenFolder,
  onAddFolder,
  onSpawnSession,
  onShutdownSession,
}: Props) {
  const { t } = useI18n();
  const [detailed, setDetailed] = useState(false);
  const [dismissedReveal, setDismissedReveal] = useState<number | null>(null);
  const showingDetails =
    detailed ||
    (revealRequest != null && revealRequest.nonce !== dismissedReveal);
  const toggleDetails = () => {
    if (document.querySelector('dialog[open], [role="dialog"]')) return;
    setDetailed(!showingDetails);
    setDismissedReveal(revealRequest?.nonce ?? null);
  };
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [allEnded, setAllEnded] = useState<Set<string>>(new Set());
  const visibleSessions = sessions
    .filter((session) => !session.hidden)
    .sort((a, b) => selectBadgeTimestamp(b) - selectBadgeTimestamp(a));
  const projects = [
    ...new Set([...folders, ...visibleSessions.map((session) => session.cwd)]),
  ];
  const needle = query.trim().toLowerCase();
  const matching = visibleSessions.filter((session) =>
    `${getSessionDisplayName(session)} ${session.cwd}`
      .toLowerCase()
      .includes(needle),
  );
  return (
    <div className="workspace-explorer">
      <header className="workspace-explorer-heading">
        <h2>{t("workbench.explorer", undefined, "EXPLORER")}</h2>
        <button
          type="button"
          aria-pressed={showingDetails}
          onClick={toggleDetails}
          title={t(
            "workbench.detailedHint",
            undefined,
            "Switch between compact navigation and full session controls",
          )}
        >
          <Icon path={mdiTuneVariant} size={0.65} />
          {showingDetails
            ? t("workbench.compactView", undefined, "Compact view")
            : t("workbench.detailedView", undefined, "Detailed view")}
        </button>
      </header>
      <div
        className="workspace-explorer-detailed"
        style={{ display: showingDetails ? undefined : "none" }}
      >
        {children}
      </div>
      {!showingDetails && (
        <>
          <div className="workspace-explorer-search">
            <Icon path={mdiMagnify} size={0.65} />
            <input
              type="search"
              aria-label={t(
                "workbench.filter",
                undefined,
                "Filter projects and sessions",
              )}
              placeholder={t(
                "workbench.filterPlaceholder",
                undefined,
                "Filter sessions…",
              )}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="workspace-explorer-label">
            <span>{t("workbench.projects", undefined, "Projects")}</span>
            <button
              type="button"
              onClick={onAddFolder}
              aria-label={t("workbench.addProject", undefined, "Add project")}
              title={t("workbench.addProject", undefined, "Add project")}
            >
              <Icon path={mdiPlus} size={0.65} />
            </button>
          </div>
          <nav
            className="workspace-explorer-tree"
            aria-label={t(
              "workbench.projectSessions",
              undefined,
              "Projects and sessions",
            )}
          >
            {projects
              .filter(
                (cwd) =>
                  !needle ||
                  cwd.toLowerCase().includes(needle) ||
                  matching.some((session) => session.cwd === cwd),
              )
              .map((cwd) => {
                const rows = matching.filter((session) => session.cwd === cwd);
                const live = rows.filter(
                  (session) => session.status !== "ended",
                );
                const ended = rows.filter(
                  (session) => session.status === "ended",
                );
                const showAllEnded =
                  Boolean(needle) || allEnded.has(cwd) ||
                  ended.slice(10).some((session) => session.id === selectedId);
                const expanded = Boolean(needle) || !collapsed.has(cwd);
                const renderRow = (session: DashboardSession) => (
                  <ExplorerSessionRow
                    key={session.id}
                    session={session}
                    selected={selectedId === session.id}
                    onSelect={onSelect}
                    onShutdown={onShutdownSession}
                  />
                );
                return (
                  <section className="workspace-explorer-project" key={cwd}>
                    <div className="workspace-explorer-folder">
                      <button
                        type="button"
                        className="workspace-explorer-collapse"
                        aria-label={`${t("workbench.toggleProject", undefined, "Toggle project")} ${folderName(cwd)}`}
                        aria-expanded={expanded}
                        onClick={() =>
                          setCollapsed((previous) => {
                            const next = new Set(previous);
                            if (next.has(cwd)) next.delete(cwd);
                            else next.add(cwd);
                            return next;
                          })
                        }
                      >
                        <Icon
                          path={expanded ? mdiChevronDown : mdiChevronRight}
                          size={0.5}
                        />
                      </button>
                      <button
                        type="button"
                        className="workspace-explorer-folder-link"
                        onClick={() => onOpenFolder(cwd)}
                        title={cwd}
                      >
                        <Icon path={mdiFolderOutline} size={0.7} />
                        <strong>{folderName(cwd)}</strong>
                      </button>
                      <span>{live.length}</span>
                      <button
                        type="button"
                        className="workspace-explorer-new"
                        onClick={() => onSpawnSession(cwd)}
                        aria-label={`${t("workbench.newSessionIn", undefined, "New session in")} ${folderName(cwd)}`}
                        title={t(
                          "landing.startSession",
                          undefined,
                          "Start session",
                        )}
                      >
                        <Icon path={mdiPlus} size={0.65} />
                      </button>
                    </div>
                    {expanded && (
                      <>
                        {live.map(renderRow)}
                        {live.length === 0 && ended.length === 0 && (
                          <button
                            type="button"
                            className="workspace-explorer-start"
                            onClick={() => onSpawnSession(cwd)}
                          >
                            <Icon path={mdiPlus} size={0.55} />
                            {t(
                              "landing.startSession",
                              undefined,
                              "Start session",
                            )}
                          </button>
                        )}
                        {ended.length > 0 && (
                          <details
                            className="workspace-explorer-ended"
                            onToggle={(event) => {
                              if (!event.currentTarget.open) {
                                setAllEnded((previous) => {
                                  if (!previous.has(cwd)) return previous;
                                  const next = new Set(previous);
                                  next.delete(cwd);
                                  return next;
                                });
                              }
                            }}
                            open={
                              needle ||
                              ended.some((session) => session.id === selectedId)
                                ? true
                                : undefined
                            }
                          >
                            <summary>
                              {t("common.ended", undefined, "Ended")} ·{" "}
                              {ended.length}
                            </summary>
                            {(showAllEnded ? ended : ended.slice(0, 10)).map(
                              renderRow,
                            )}
                            {!showAllEnded && ended.length > 10 && (
                              <button
                                type="button"
                                className="workspace-explorer-start"
                                onClick={() =>
                                  setAllEnded((previous) => new Set([...previous, cwd]))
                                }
                              >
                                {t("workbench.showAllEnded", undefined, "Show all")} · {ended.length}
                              </button>
                            )}
                          </details>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
            {projects.length === 0 && (
              <div className="workspace-explorer-empty">
                <Icon path={mdiCodeBraces} size={1} />
                <p>
                  {t(
                    "workbench.explorerEmpty",
                    undefined,
                    "Your projects live here.",
                  )}
                </p>
                <button type="button" onClick={onAddFolder}>
                  {t("workbench.addProject", undefined, "Add project")}
                </button>
              </div>
            )}
            {needle &&
              !matching.length &&
              !projects.some((cwd) => cwd.toLowerCase().includes(needle)) && (
                <p className="workspace-explorer-no-results" role="status">
                  {t(
                    "workbench.noResults",
                    undefined,
                    "No matching sessions or projects.",
                  )}
                </p>
              )}
          </nav>
          <footer className="workspace-explorer-footer">
            <span>
              {t("workbench.explorerTip", undefined, "Need more controls?")}
            </span>
            <button type="button" onClick={() => setDetailed(true)}>
              {t("workbench.openDetailed", undefined, "Open detailed view")} →
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

function ExplorerSessionRow({
  session,
  selected,
  onSelect,
  onShutdown,
}: {
  session: DashboardSession;
  selected: boolean;
  onSelect: (id: string) => void;
  onShutdown?: (sessionId: string) => void;
}) {
  const { t } = useI18n();
  const label = sessionLabel(session);
  const stateClasses: Record<string, string> = {
    "Needs you": "attention",
    Working: "working",
    Ended: "ended",
    Ready: "ready",
  };
  const canExit = session.status !== "ended" && Boolean(onShutdown);
  return (
    <div className="workspace-explorer-session-row">
      <button
        type="button"
        className={`workspace-explorer-session ${selected ? "is-selected" : ""}`}
        onClick={() => onSelect(session.id)}
        aria-current={selected ? "page" : undefined}
        title={`${getSessionDisplayName(session)} — ${label}`}
      >
        <span
          className={`workspace-tree-status ${stateClasses[label]}`}
          aria-hidden="true"
        />
        <span>{getSessionDisplayName(session)}</span>
        <small>
          {label === "Ready"
            ? ""
            : t(`workbench.status.${label}`, undefined, label)}
        </small>
      </button>
      {canExit && (
        <button
          type="button"
          className="workspace-explorer-exit"
          disabled={session.closing}
          aria-label={`${t("session.exitSession", undefined, "Exit session")} ${getSessionDisplayName(session)}`}
          title={session.closing ? t("session.closing", undefined, "Closing…") : t("session.exitPiSession", undefined, "Exit pi session")}
          onClick={() => {
            if (session.closing || !onShutdown) return;
            if (session.status === "streaming" && !window.confirm(t("session.exitWhileRunningConfirm", undefined, "Session is currently running. Exit anyway?"))) return;
            onShutdown(session.id);
          }}
        >
          <Icon path={session.closing ? mdiLoading : mdiClose} size={0.55} className={session.closing ? "animate-spin" : undefined} />
        </button>
      )}
    </div>
  );
}
