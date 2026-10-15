import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import {
  mdiArrowRight,
  mdiCodeBraces,
  mdiFolderOutline,
  mdiPlus,
  mdiSourceBranch,
} from "@mdi/js";
import Icon from "@mdi/react";
import { useI18n } from "../../lib/i18n/i18n.js";
import { getSessionDisplayName } from "../../lib/session/session-display-name.js";

interface Props {
  sessions: DashboardSession[];
  folders: string[];
  onSelect: (id: string) => void;
  onOpenFolder: (cwd: string) => void;
  onAddFolder: () => void;
}

export function needsAttention(session: DashboardSession) {
  return (
    session.status !== "ended" &&
    (session.awaitingFileAccess === true || session.currentTool === "ask_user")
  );
}

export function sessionLabel(session: DashboardSession) {
  if (session.status === "ended") return "Ended";
  if (needsAttention(session)) return "Needs you";
  if (session.status === "streaming" || session.currentTool) return "Working";
  return "Ready";
}

export function folderName(cwd: string) {
  return cwd.split(/[\\/]/).filter(Boolean).pop() || cwd;
}

export function WorkspaceOverview({
  sessions,
  folders,
  onSelect,
  onOpenFolder,
  onAddFolder,
}: Props) {
  const { t } = useI18n();
  const live = sessions.filter((session) => session.status !== "ended" && !session.hidden);
  const attention = live.filter(needsAttention).length;
  const working = live.filter(
    (session) =>
      !needsAttention(session) && sessionLabel(session) === "Working",
  ).length;
  const recent = [...live]
    .sort(
      (a, b) =>
        Number(needsAttention(b)) - Number(needsAttention(a)) ||
        (b.lastActivityAt ?? b.startedAt) - (a.lastActivityAt ?? a.startedAt),
    )
    .slice(0, 8);
  const projects = [
    ...new Set([...folders, ...live.map((session) => session.cwd)]),
  ];
  return (
    <main className="workspace-overview" aria-labelledby="workspace-heading">
      <div className="workspace-overview-inner">
        <div className="workspace-eyebrow">
          <span className="workspace-logo" aria-hidden="true">
            π
          </span>{" "}
          {t("workbench.home", undefined, "YOUR WORKSPACE")}
        </div>
        <header className="workspace-intro">
          <div>
            <h1 id="workspace-heading">
              {t(
                "workbench.heading",
                undefined,
                "A little focus. A lot of possibility.",
              )}
            </h1>
            <p>
              {t(
                "workbench.subtitle",
                undefined,
                "Pick up where you left off, or make room for your next idea.",
              )}
            </p>
          </div>
          <button
            type="button"
            className="workspace-primary"
            onClick={onAddFolder}
          >
            <Icon path={mdiPlus} size={0.65} />
            {t("workbench.addProject", undefined, "Add project")}
          </button>
        </header>

        <section
          className="workspace-metrics"
          aria-label={t("workbench.activity", undefined, "Session activity")}
        >
          {[
            [
              live.length,
              t("workbench.active", undefined, "Active sessions"),
              "active",
            ],
            [
              working,
              t("workbench.working", undefined, "Running now"),
              "working",
            ],
            [
              attention,
              t("workbench.attention", undefined, "Need your attention"),
              "attention",
            ],
          ].map(([count, label, kind]) => (
            <div className="workspace-metric" key={kind}>
              <span className={`workspace-metric-dot ${kind}`} />
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </section>

        <div className="workspace-columns">
          <section
            className="workspace-recent"
            aria-labelledby="recent-heading"
          >
            <div className="workspace-section-heading">
              <h2 id="recent-heading">
                {t("workbench.recent", undefined, "Continue working")}
              </h2>
              <span>{t("workbench.live", undefined, "LIVE SESSIONS")}</span>
            </div>
            {recent.length === 0 ? (
              <div className="workspace-empty">
                <Icon path={mdiCodeBraces} size={1.4} />
                <h3>
                  {t(
                    "workbench.empty",
                    undefined,
                    "Your next idea starts here.",
                  )}
                </h3>
                <p>
                  {t(
                    "workbench.emptyHint",
                    undefined,
                    "Open a project to start a new agent session.",
                  )}
                </p>
              </div>
            ) : (
              recent.map((session) => (
                <button
                  type="button"
                  key={session.id}
                  className="workspace-session"
                  data-testid="overview-session"
                  onClick={() => onSelect(session.id)}
                >
                  <span className="workspace-session-icon">
                    <Icon path={mdiCodeBraces} size={0.8} />
                  </span>
                  <span className="workspace-session-copy">
                    <strong>{getSessionDisplayName(session)}</strong>
                    <span>
                      {folderName(session.cwd)}
                      {session.gitBranch && (
                        <>
                          <span className="workspace-meta-divider">/</span>
                          <Icon path={mdiSourceBranch} size={0.48} />
                          {session.gitBranch}
                        </>
                      )}
                    </span>
                  </span>
                  <span
                    className={`workspace-session-status ${needsAttention(session) ? "attention" : sessionLabel(session) === "Working" ? "working" : "ready"}`}
                  >
                    <i aria-hidden="true" />
                    {t(
                      `workbench.status.${sessionLabel(session)}`,
                      undefined,
                      sessionLabel(session),
                    )}
                  </span>
                  <Icon
                    path={mdiArrowRight}
                    size={0.65}
                    className="workspace-row-arrow"
                  />
                </button>
              ))
            )}
            <div className="workspace-tip">
              <kbd>Ctrl / ⌘ K</kbd>
              <span>
                {t(
                  "workbench.tip",
                  undefined,
                  "Jump to any session or project. Keep your flow.",
                )}
              </span>
            </div>
          </section>
          <aside
            className="workspace-projects"
            aria-labelledby="projects-heading"
          >
            <div className="workspace-section-heading">
              <h2 id="projects-heading">
                {t("workbench.projects", undefined, "Projects")}
              </h2>
              <span>{projects.length}</span>
            </div>
            {projects.length === 0 && (
              <p className="workspace-project-hint">
                {t(
                  "workbench.noProjects",
                  undefined,
                  "Add a folder to bring your work together.",
                )}
              </p>
            )}
            {projects.map((cwd) => (
              <button
                type="button"
                key={cwd}
                className="workspace-project"
                data-testid="overview-project"
                aria-label={`${t("common.open", undefined, "Open")} ${folderName(cwd)}`}
                onClick={() => onOpenFolder(cwd)}
                title={cwd}
              >
                <Icon path={mdiFolderOutline} size={0.8} />
                <span>
                  <strong>{folderName(cwd)}</strong>
                  <small>{cwd}</small>
                </span>
                <Icon path={mdiArrowRight} size={0.6} />
              </button>
            ))}
            <div className="workspace-note">
              <span aria-hidden="true">✳</span>
              <strong>
                {t(
                  "workbench.noteTitle",
                  undefined,
                  "One workspace. Many possibilities.",
                )}
              </strong>
              <p>
                {t(
                  "workbench.note",
                  undefined,
                  "Run agents side by side. Review their changes. Stay in control of what ships.",
                )}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
