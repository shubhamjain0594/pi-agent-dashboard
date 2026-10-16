import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import {
  mdiArrowRight,
  mdiChevronRight,
  mdiCogOutline,
  mdiConsoleLine,
  mdiFolderOutline,
  mdiHomeOutline,
  mdiMagnify,
  mdiMenu,
  mdiPageLayoutSidebarLeft,
  mdiPlus,
} from "@mdi/js";
import { Icon } from "@mdi/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import type { ConnectionStatus } from "../../hooks/useWebSocket.js";
import { useI18n } from "../../lib/i18n/i18n.js";
import { buildFolderHomeUrl } from "../../lib/nav/route-builders.js";
import { getSessionDisplayName } from "../../lib/session/session-display-name.js";
import { ThemePicker } from "../settings/ThemePicker.js";
import { ThemeToggle } from "../settings/ThemeToggle.js";
import { folderName } from "./WorkspaceOverview.js";
import "../../styles/workbench.css";

interface Props {
  children: ReactNode;
  sessions: DashboardSession[];
  folders: string[];
  selectedSession?: DashboardSession;
  status: ConnectionStatus;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onSelect: (id: string) => void;
  onAddFolder: () => void;
  navigate: (to: string) => void;
}

/** Desktop chrome only. Existing route surfaces and providers remain the body. */
export function DesktopWorkbench({
  children,
  sessions,
  folders,
  selectedSession,
  status,
  sidebarCollapsed,
  onToggleSidebar,
  onSelect,
  onAddFolder,
  navigate,
}: Props) {
  const { t } = useI18n();
  const [location] = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const isHome = location === "/";
  const isSession = location.startsWith("/session/");
  const settings = location.startsWith("/settings");
  const openSearch = useCallback(() => {
    if (document.querySelector('dialog[open], [role="dialog"]')) return;
    setQuery("");
    setActive(0);
    if (!dialog.current?.open) dialog.current?.showModal();
    search.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey)
      )
        return;
      // Do not compete with another dialog or Monaco's own shortcuts.
      if (
        document.querySelector(
          'dialog[open], [role="dialog"], .monaco-editor.focused, .xterm.focus',
        )
      )
        return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      } else if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        onToggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onToggleSidebar, openSearch]);

  const visibleSessions = sessions.filter((session) => !session.hidden);
  const commands = [
    ...visibleSessions.map((session) => ({
      id: `session-${session.id}`,
      label: getSessionDisplayName(session),
      detail: folderName(session.cwd),
      icon: mdiConsoleLine,
      run: () => onSelect(session.id),
    })),
    ...[
      ...new Set([...folders, ...visibleSessions.map((session) => session.cwd)]),
    ].map((cwd) => ({
      id: `folder-${cwd}`,
      label: folderName(cwd),
      detail: cwd,
      icon: mdiFolderOutline,
      run: () => navigate(buildFolderHomeUrl(cwd)),
    })),
    {
      id: "home",
      label: t("workbench.overview", undefined, "Workspace overview"),
      detail: "",
      icon: mdiHomeOutline,
      run: () => navigate("/"),
    },
    {
      id: "add",
      label: t("workbench.addProject", undefined, "Add project"),
      detail: "",
      icon: mdiPlus,
      run: onAddFolder,
    },
    {
      id: "settings",
      label: t("sessionList.settings", undefined, "Settings"),
      detail: "",
      icon: mdiCogOutline,
      run: () => navigate("/settings"),
    },
  ]
    .filter((command) =>
      `${command.label} ${command.detail}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice(0, 30);
  const runCommand = (index: number) => {
    const command = commands[index];
    if (!command) return;
    dialog.current?.close();
    command.run();
  };
  const title = settings
    ? t("sessionList.settings", undefined, "Settings")
    : selectedSession
      ? getSessionDisplayName(selectedSession)
      : t("workbench.overview", undefined, "Workspace overview");
  const liveCount = visibleSessions.filter(
    (session) => session.status !== "ended",
  ).length;

  return (
    <div className="desktop-workbench" data-testid="desktop-workbench">
      {!isSession && <header className="workbench-titlebar">
        <button
          type="button"
          className="workbench-brand"
          onClick={() => navigate("/")}
          title={t("common.home", undefined, "Home")}
        >
          <span aria-hidden="true">π</span>
          <strong>pi</strong>
          <span className="workbench-brand-label">workspace</span>
        </button>
        <button
          type="button"
          className="workbench-command-trigger"
          onClick={openSearch}
          aria-label={t(
            "workbench.search",
            undefined,
            "Search sessions and projects",
          )}
        >
          <Icon path={mdiMagnify} size={0.65} />
          <span>
            {t(
              "workbench.searchHint",
              undefined,
              "Search sessions, projects, commands…",
            )}
          </span>
          <kbd>Ctrl / ⌘ K</kbd>
        </button>
        <button
          type="button"
          className="workbench-icon-button"
          onClick={onToggleSidebar}
          aria-pressed={!sidebarCollapsed}
          aria-label={t(
            "workbench.toggleSidebar",
            undefined,
            "Toggle session sidebar",
          )}
          title={t("shell.toggleSidebarHint", undefined, "Ctrl / ⌘ B")}
        >
          <Icon path={mdiPageLayoutSidebarLeft} size={0.75} />
        </button>
      </header>}
      <div className="workbench-body">
        <nav
          className="workbench-rail"
          aria-label={t(
            "workbench.navigation",
            undefined,
            "Workspace navigation",
          )}
        >
          <button
            type="button"
            className={isHome ? "is-active" : ""}
            aria-current={isHome ? "page" : undefined}
            onClick={() => navigate("/")}
            aria-label={t(
              "workbench.overview",
              undefined,
              "Workspace overview",
            )}
            title={t("workbench.overview", undefined, "Workspace overview")}
          >
            <Icon path={mdiHomeOutline} size={0.9} />
          </button>
          <button
            type="button"
            aria-pressed={!sidebarCollapsed}
            onClick={onToggleSidebar}
            aria-label={t("workbench.sessions", undefined, "Toggle sessions")}
            title={t("workbench.sessions", undefined, "Toggle sessions")}
          >
            <Icon path={mdiMenu} size={0.9} />
          </button>
          <button
            type="button"
            onClick={openSearch}
            aria-label={t("workbench.quickOpen", undefined, "Quick open")}
            title={t("workbench.quickOpen", undefined, "Quick open")}
          >
            <Icon path={mdiMagnify} size={0.9} />
          </button>
          <button
            type="button"
            onClick={onAddFolder}
            aria-label={t("workbench.addProject", undefined, "Add project")}
            title={t("workbench.addProject", undefined, "Add project")}
          >
            <Icon path={mdiFolderOutline} size={0.9} />
          </button>
          <span className="workbench-rail-spacer" />
          <button
            type="button"
            className={settings ? "is-active" : ""}
            aria-current={settings ? "page" : undefined}
            onClick={() => navigate("/settings")}
            aria-label={t("sessionList.settings", undefined, "Settings")}
            title={t("sessionList.settings", undefined, "Settings")}
          >
            <Icon path={mdiCogOutline} size={0.9} />
          </button>
        </nav>
        <div className="workbench-surfaces">{children}</div>
      </div>
      <footer className="workbench-statusbar">
        <span className={`workbench-connection ${status}`}>
          <i aria-hidden="true" />
          {status === "connected"
            ? t("workbench.connected", undefined, "Connected")
            : status === "connecting"
              ? t("workbench.connecting", undefined, "Connecting…")
              : status === "auth_required"
                ? t("workbench.authRequired", undefined, "Sign-in required")
                : t("workbench.offline", undefined, "Offline")}
        </span>
        <span>
          {liveCount}{" "}
          {t("workbench.sessionsCount", undefined, "active sessions")}
        </span>
        <span className="workbench-theme-controls">
          <ThemePicker showName />
          <ThemeToggle />
        </span>
        <span className="workbench-status-context">
          {selectedSession?.gitBranch && (
            <>
              <Icon path={mdiChevronRight} size={0.55} />
              {selectedSession.gitBranch}
            </>
          )}
        </span>
        <span className="workbench-status-title">{title}</span>
        <span>pi dashboard</span>
      </footer>
      <dialog
        ref={dialog}
        className="workbench-command-dialog"
        aria-labelledby="workbench-command-heading"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const next = commands.length
              ? (active +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  commands.length) %
                commands.length
              : 0;
            setActive(next);
            dialog.current
              ?.querySelector(`[data-command-index="${next}"]`)
              ?.scrollIntoView({ block: "nearest" });
          } else if (event.key === "Enter" && event.target === search.current) {
            event.preventDefault();
            runCommand(active);
          }
        }}
      >
        <div className="workbench-command-search">
          <Icon path={mdiMagnify} size={0.8} />
          <label
            className="sr-only"
            id="workbench-command-heading"
            htmlFor="workbench-command-input"
          >
            {t("workbench.search", undefined, "Search sessions and projects")}
          </label>
          <input
            ref={search}
            id="workbench-command-input"
            placeholder={t(
              "workbench.commandPlaceholder",
              undefined,
              "Where would you like to go?",
            )}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={t("common.close", undefined, "Close")}
          >
            Esc
          </button>
        </div>
        <div
          className="workbench-command-results"
          aria-label={t("workbench.results", undefined, "Search results")}
        >
          {commands.length === 0 && (
            <p role="status">
              {t(
                "workbench.noResults",
                undefined,
                "No matching sessions or projects.",
              )}
            </p>
          )}
          {commands.map((command, index) => (
            <button
              type="button"
              key={command.id}
              data-command-index={index}
              className={index === active ? "is-active" : ""}
              onFocus={() => setActive(index)}
              onClick={() => runCommand(index)}
            >
              <Icon path={command.icon} size={0.75} />
              <span>
                <strong>{command.label}</strong>
                <small>{command.detail}</small>
              </span>
              <Icon path={mdiArrowRight} size={0.6} />
            </button>
          ))}
        </div>
        <footer>
          <span>↑ ↓ {t("workbench.navigate", undefined, "to navigate")}</span>
          <span>↵ {t("workbench.open", undefined, "to open")}</span>
        </footer>
      </dialog>
    </div>
  );
}
