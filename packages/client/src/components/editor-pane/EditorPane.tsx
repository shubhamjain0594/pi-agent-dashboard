/**
 * Editor pane shell — composes the tab strip, the collapsible + resizable
 * file-tree rail, and the active viewer. Viewer resolution is split by open
 * path: the four pseudo-tab kinds render from `pseudoTabRegistry` directly,
 * every other kind goes through `CappedViewer` (size gate + `viewerRegistry`).
 * See change: cleanup-import-cycles (D3).
 * Co-mounts alongside `ChatView` inside `SplitWorkspace`. Read-only in v1.
 *
 * State (open tabs, tree expansion) and the file-open plumbing come from
 * `SplitWorkspaceContext` so tree clicks, chat file-links, and search results
 * all funnel through one `openInSplit`. The inner rail↔viewer divider resizes
 * the rail independently of the outer chat/editor split.
 *
 * See change: add-internal-monaco-editor-pane, split-editor-workspace.
 */

import { fileKind } from "@blackbelt-technology/pi-dashboard-shared/file-kind.js";
import { mdiClose, mdiConsoleLine, mdiFileTreeOutline, mdiMagnify, mdiRefresh, mdiWeb } from "@mdi/js";
import { Icon } from "@mdi/react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../primitives/ErrorBoundary.js";
import { grepContents } from "../../lib/api/grep-api.js";
import { useI18n } from "../../lib/i18n/i18n.js";
import { useRailWidth } from "../../lib/layout/rail-width.js";
import { useTreeVisible } from "../../lib/util/tree-visible.js";
import { stripTermId } from "../../lib/layout/use-terminal-pane-tabs.js";
import { SplitDivider } from "../split/SplitDivider.js";
import { useSplitWorkspace } from "../split/SplitWorkspaceContext.js";
import { ChangedOnDiskBanner } from "./ChangedOnDiskBanner.js";
import { EditorFileTree } from "./EditorFileTree.js";
import { EditorSearchPanel } from "./EditorSearchPanel.js";
import { EditorTabs } from "./EditorTabs.js";
// D3 (change: add-lazy-terminal-diff-bootstrap): the keep-alive terminal layer
// is a lazy boundary. `React.lazy` fires its import as soon as it is rendered,
// so the mount is gated on the sticky `terminalActivated` latch — NOT on "a
// terminal tab exists" (already true on a reload with persisted term tabs and
// on every folder pane).
const TerminalPaneLayer = lazy(() => import("./TerminalPaneLayer.js").then((m) => ({ default: m.TerminalPaneLayer })));
import { useServerCapabilities } from "../../hooks/useServerCapabilities.js";
import { PreviewProvenance } from "../../lib/access-grants/preview-provenance.js";
import { CappedViewer } from "./CappedViewer.js";
import { EditorPaneTabLabelSlot, useShellSessionOrNull } from "@blackbelt-technology/dashboard-plugin-runtime";
import { PluginTabHost, pluginTabPrefix } from "./PluginTabHost.js";
import { pseudoTabRegistry } from "./pseudo-tab-registry.js";
import { isPseudoTabViewer } from "./viewer-kinds.js";
import { TabActions, type TabActionTarget } from "./TabActions.js";
import { SessionTodosPanel } from "../session/SessionTodosPanel.js";
import { useSubagentSnapshot } from "@blackbelt-technology/pi-dashboard-subagents-plugin/client/useSubagentData";
const SubagentsPanel = lazy(() => import("@blackbelt-technology/pi-dashboard-subagents-plugin/client/SubagentsPanel").then((m) => ({ default: m.SubagentsPanel })));
import { SessionChangesPanel } from "../diff/SessionChangesPanel.js";
import { useOptionalSessionDiff } from "../diff/SessionDiffContext.js";

const absOf = (cwd: string, rel: string): string => (rel ? `${cwd}/${rel}` : cwd);

export function EditorPane() {
  const { t } = useI18n();
  const {
    sessionId,
    workPanel = "editor",
    setWorkPanel,
    openChanges,
    openTasks,
    todoSnapshot = null,
    tasksEnabled = true,
    openSubagent,
    cwd,
    paneState: state,
    dispatch,
    updateSplit,
    openInSplit,
    pendingScroll,
    consumePendingScroll,
    fileResults,
    onFilenameSearch,
    changedFiles,
    clearChanged,
    openDiffTab,
    terminal,
    terminalActivated,
  } = useSplitWorkspace();
  const sessionDiff = useOptionalSessionDiff();
  const taskCount = todoSnapshot?.tasks.filter(task => task.status !== "deleted").length;
  // Subagents sub-tab: shown only while the session reports runs. See change: rewrite-subagent-inspector-for-pi-subagents.
  const subagentSnapshot = useSubagentSnapshot(sessionId);
  const hasSubagents = (subagentSnapshot?.runs.length ?? 0) > 0;
  const [tasksTab, setTasksTab] = useState<"todos" | "subagents">("todos");
  useEffect(() => setTasksTab("todos"), [sessionId]);
  const activeTasksTab = tasksTab === "subagents" && hasSubagents ? "subagents" : "todos";
  const terminalTitle = useCallback(
    (id: string) => {
      const s = terminal.terminals.find((t) => t.id === id);
      return s?.title || s?.shell?.split("/").pop() || undefined;
    },
    [terminal.terminals],
  );
  // Plugin tab labels: the claim's label component (always mounted, so a
  // background tab stays live), else the prefix. See change: add-browser-editor-pane-tab.
  const shellSession = useShellSessionOrNull(sessionId);
  const pluginLabel = useCallback(
    (path: string) => <EditorPaneTabLabelSlot path={path} session={shellSession} fallback={pluginTabPrefix(path)} />,
    [shellSession],
  );
  const [treeVisible, setTreeVisible] = useTreeVisible(sessionId);
  // Preserve review selection/scroll when opening a separate source tab, but
  // do not mount a review (or its diff viewers) before it has been visited.
  const [reviewSession, setReviewSession] = useState<string | null>(null);
  useEffect(() => {
    if (workPanel === "changes") setReviewSession(sessionId);
  }, [workPanel, sessionId]);
  // rpiv-todo uninstalled while the Tasks tab was open: fall back to the editor.
  useEffect(() => {
    if (!tasksEnabled && workPanel === "tasks") setWorkPanel?.("editor");
  }, [tasksEnabled, workPanel, setWorkPanel]);
  const openFileEditor = (path: string, line?: number) => {
    openInSplit(path, line);
    setTreeVisible(false);
    updateSplit({ mode: "full" });
  };
  const openDiffEditor = (path: string) => {
    openDiffTab(path);
    setTreeVisible(false);
    updateSplit({ mode: "full" });
  };
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [railWidth, setRailWidth] = useRailWidth(sessionId);

  // Cmd/Ctrl-P (filenames) or Cmd/Ctrl-Shift-F (contents) toggles the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.defaultPrevented) return;
      if (e.key === "p" || e.key === "P" || (e.shiftKey && (e.key === "f" || e.key === "F"))) {
        e.preventDefault();
        setWorkPanel?.("editor");
        setSearchOpen((v) => workPanel === "editor" ? !v : true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setWorkPanel, workPanel]);

  const onContentSearch = useCallback(
    (q: string, regex: boolean) => grepContents(cwd, q, regex),
    [cwd],
  );
  // Tree+viewer row — its left edge anchors the rail-width drag math so the
  // width stays correct regardless of the outer split ratio.
  const rowRef = useRef<HTMLDivElement>(null);
  // Scroll target for the active tab, latched from the pending-scroll signal.
  const [scrollTo, setScrollTo] = useState<{ path: string; line: number } | null>(null);

  const activeTab = state.activeIndex >= 0 ? state.openFiles[state.activeIndex] : null;
  const activePath = activeTab?.path ?? null;

  // System-open tab actions (D9). Gated on the server capability; only a real
  // file or a url tab exposes an action (virtual live-server/diff/terminal do
  // not). See change: open-view-command-in-editor-pane.
  const caps = useServerCapabilities();
  // `url` MUST be tested before the pseudo-tab guard: it is the one pseudo-tab
  // kind that still exposes an action. Collapsing all four onto the guard would
  // silently drop system-open for `url:` tabs, with no type error.
  const tabActionTarget: TabActionTarget | null = !activeTab
    ? null
    : activeTab.viewer === "url"
      ? { kind: "url", url: activeTab.path.replace(/^url:/, "") }
      : isPseudoTabViewer(activeTab.viewer)
        ? null
        : { kind: "file", cwd, path: activeTab.path };

  // Honour a pending scroll for the active tab exactly once, then clear it.
  useEffect(() => {
    if (pendingScroll && pendingScroll.path === activePath) {
      setScrollTo(pendingScroll);
      consumePendingScroll();
    }
  }, [pendingScroll, activePath, consumePendingScroll]);

  const lineForTab = scrollTo && scrollTo.path === activePath ? scrollTo.line : undefined;

  let body: React.ReactNode;
  if (!activeTab) {
    body = (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">
        {t("editor.noFilesOpen", undefined, "No files open — pick one from the tree.")}
      </div>
    );
  } else {
    const classification = fileKind(absOf(cwd, activeTab.path));
    // NOTE: `classification` is computed for every tab, including pseudo-tab
    // paths where its `.viewer` is wrong (`diff:src/foo.ts` → `monaco`). Only
    // `.kind`/`.mimeType` are consumed. `activeTab.viewer` is the discriminator.
    //
    // Bound to a local so the `isPseudoTabViewer` guard narrows it: the else
    // branch becomes `OpenPathViewer`, which is what lets `tsc` catch a
    // mis-routed kind instead of deferring it to a runtime `<undefined/>`.
    // Never replace this with a cast.
    const viewer = activeTab.viewer;
    // `autoOpened` is in the key: a provenance change on the active tab remounts
    // it, so its next request uses the new eligibility (surface-denial-remedy-in-previews, D4).
    const autoOpened = activeTab.autoOpened === true;
    const viewerKey = `${activeTab.path}:${refreshNonce}:${lineForTab ?? ""}:${autoOpened}`;
    const viewerProps = {
      cwd,
      path: activeTab.path,
      kind: classification.kind,
      mimeType: classification.mimeType,
      size: 0,
      line: lineForTab,
      restrictCsp: activeTab.restrictCsp,
    };
    // Plugin tabs render through PluginTabHost (claim by prefix, richer
    // props); never the registry, never CappedViewer (no `/api/file`).
    // See change: add-browser-editor-pane-tab (D1).
    const activeIdx = state.activeIndex;
    const PseudoTabViewerComponent =
      isPseudoTabViewer(viewer) && viewer !== "plugin" ? pseudoTabRegistry[viewer] : null;
    body = (
      <PreviewProvenance autoOpened={autoOpened}>
        <Suspense fallback={<div className="p-4 text-sm text-[var(--text-tertiary)]">{t("editor.loadingViewer", undefined, "Loading viewer…")}</div>}>
          {viewer === "plugin" ? (
            <PluginTabHost
              key={activeTab.path}
              path={activeTab.path}
              sessionId={sessionId}
              isActive
              onClose={() => dispatch({ type: "closeTab", index: activeIdx })}
            />
          ) : PseudoTabViewerComponent ? (
            <PseudoTabViewerComponent key={viewerKey} {...viewerProps} />
          ) : isPseudoTabViewer(viewer) ? null : (
            <CappedViewer key={viewerKey} viewer={viewer} {...viewerProps} />
          )}
        </Suspense>
      </PreviewProvenance>
    );
  }

  const language = activeTab ? activeTab.path.slice(activeTab.path.lastIndexOf(".") + 1) : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="session-inspector">
      <nav className="session-work-tabs" aria-label={t("review.inspectorViews", undefined, "Session inspector views")}>
        <button type="button" aria-pressed={workPanel === "changes"} onClick={() => openChanges?.()} data-testid="inspector-changes">{t("common.changes", undefined, "Changes")}{sessionDiff?.data && <span>{sessionDiff.data.files.length}</span>}</button>
        {tasksEnabled && <button type="button" aria-pressed={workPanel === "tasks"} onClick={() => openTasks?.()} data-testid="inspector-tasks">{t("review.tasks", undefined, "Tasks")}{taskCount != null && <span>{taskCount}</span>}</button>}
        <button type="button" aria-pressed={workPanel === "editor"} onClick={() => setWorkPanel?.("editor")} data-testid="inspector-editor">{t("editor.editorTitle", undefined, "Editor")}</button>
        {workPanel === "editor" && (
          <div className="session-work-tools">
            <button
              type="button"
              onClick={() => setTreeVisible(!treeVisible)}
              aria-pressed={treeVisible}
              aria-label={t("editor.toggleFileTree", undefined, "Toggle file tree")}
              data-testid="tree-toggle"
              className={[
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
                treeVisible
                  ? "bg-[var(--bg-selected)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
              ].join(" ")}
              title={treeVisible ? t("editor.hideFileTree", undefined, "Hide file tree") : t("editor.showFileTree", undefined, "Show file tree")}
            >
              <Icon path={mdiFileTreeOutline} size={0.7} />
              <span>{t("common.files", undefined, "Files")}</span>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "openFile", path: "live:preview", viewer: "live-server" })}
              data-testid="live-preview-launch"
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              title={t("editor.previewLocalDevServer", undefined, "Preview a local dev server")}
            >
              <Icon path={mdiWeb} size={0.7} />
            </button>
            <button
              type="button"
              onClick={() => terminal.createTerminal()}
              data-testid="new-terminal-launch"
              className="text-[var(--text-tertiary)] hover:text-cyan-400"
              title={t("terminal.newTerminal", undefined, "New Terminal")}
            >
              <Icon path={mdiConsoleLine} size={0.7} />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-pressed={searchOpen}
              data-testid="editor-search-toggle"
              className={searchOpen ? "text-blue-400" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}
              title={t("editor.searchShortcutHint", undefined, "Search (Cmd-P / Cmd-Shift-F)")}
            >
              <Icon path={mdiMagnify} size={0.7} />
            </button>
            {tabActionTarget && <TabActions target={tabActionTarget} systemOpen={caps.systemOpen} />}
            {activeTab && (
              <button
                type="button"
                onClick={() => setRefreshNonce((n) => n + 1)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                title={t("editor.reloadFile", undefined, "Reload file")}
              >
                <Icon path={mdiRefresh} size={0.7} />
              </button>
            )}
          </div>
        )}
        <button type="button" className="session-work-close" onClick={() => updateSplit({ mode: "closed" })} aria-label={t("review.closeInspector", undefined, "Close session inspector")}><Icon path={mdiClose} size={0.65} /></button>
      </nav>
      {(workPanel === "changes" || reviewSession === sessionId) && (
        <div className="min-h-0 flex-1 flex-col" style={{ display: workPanel === "changes" ? "flex" : "none" }}>
          <SessionChangesPanel key={sessionId} cwd={cwd} onOpenFile={openFileEditor} onOpenDiff={openDiffEditor} />
        </div>
      )}
      {workPanel === "tasks" && tasksEnabled && (
        <div className="session-work-scroll flex flex-col">
          {hasSubagents && (
            <div role="tablist" className="flex gap-3 px-2 py-1 text-[11px]">
              <button type="button" role="tab" aria-selected={activeTasksTab === "todos"} data-testid="tasks-subtab-todos" onClick={() => setTasksTab("todos")} className={activeTasksTab === "todos" ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"}>{t("tasks.todos", undefined, "Todos")}</button>
              <button type="button" role="tab" aria-selected={activeTasksTab === "subagents"} data-testid="tasks-subtab-subagents" onClick={() => setTasksTab("subagents")} className={activeTasksTab === "subagents" ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"}>{t("tasks.subagents", undefined, "Subagents")}</button>
            </div>
          )}
          {activeTasksTab === "subagents" ? (
            <Suspense fallback={null}>
              <SubagentsPanel sessionId={sessionId} onOpen={(runId, childId) => openSubagent?.(runId, childId)} />
            </Suspense>
          ) : (
            <SessionTodosPanel key={sessionId} snapshot={todoSnapshot} />
          )}
        </div>
      )}
      <div className="editor-workspace min-h-0 min-w-0 flex-1 flex-col" style={{ display: workPanel === "editor" ? "flex" : "none" }}>

      {/* Tabs */}
      {state.openFiles.length > 0 && (
        <EditorTabs
          openFiles={state.openFiles}
          activeIndex={state.activeIndex}
          terminalTitle={terminalTitle}
          pluginLabel={pluginLabel}
          onActivate={(i) => dispatch({ type: "setActive", index: i })}
          onClose={(i) => {
            const f = state.openFiles[i];
            const termId = f?.viewer === "terminal" ? stripTermId(f.path) : null;
            // D4 — closing a terminal tab kills its terminal.
            if (termId) terminal.closeTerminalTab(termId);
            else dispatch({ type: "closeTab", index: i });
          }}
          onReorder={(from, to) => dispatch({ type: "reorderTabs", from, to })}
        />
      )}

      {/* Tree + inner divider + viewer */}
      <div ref={rowRef} className="flex min-h-0 flex-1">
        {treeVisible && (
          <>
            <div className="shrink-0 flex min-h-0 flex-col" style={{ width: railWidth }}>
              <div className="min-h-0 flex-1 overflow-hidden">
                <EditorFileTree
                  cwd={cwd}
                  treeOpenRoots={state.treeOpenRoots}
                  onToggleRoot={(relPath) => dispatch({ type: "toggleTreeRoot", relPath })}
                  onOpenFile={(path) => openFileEditor(path)}
                  onOpenDiff={openDiffEditor}
                  activePath={activePath}
                />
              </div>
            </div>
            <SplitDivider
              orientation="h"
              onResize={(clientX) => {
                const left = rowRef.current?.getBoundingClientRect().left ?? 0;
                setRailWidth(clientX - left);
              }}
              data-testid="rail-divider"
              title={t("editor.dragResizeRail", undefined, "Drag to resize the browse rail")}
            />
          </>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {searchOpen && (
            <EditorSearchPanel
              cwd={cwd}
              fileResults={fileResults}
              onFilenameSearch={onFilenameSearch}
              onContentSearch={onContentSearch}
              onOpen={openFileEditor}
              onClose={() => setSearchOpen(false)}
            />
          )}
          {activePath && changedFiles?.has(activePath) && (
            <ChangedOnDiskBanner
              fileName={activePath}
              onRefresh={() => {
                setRefreshNonce((n) => n + 1);
                clearChanged(activePath);
              }}
              onDismiss={() => clearChanged(activePath)}
            />
          )}
          {/* File viewer + keep-alive terminal layer share the body region.
              When a file tab is active the terminals are display:none; when a
              term tab is active `body` is the null placeholder and the layer's
              active terminal fills. See change: terminals-in-tabbed-panes. */}
          <div className="min-h-0 flex-1 flex flex-col">
            {body}
            {/* D3: mount the lazy layer only once a terminal tab has been the
                active tab. The `Suspense` fallback fills the same pane-body
                region (`min-h-0 flex-1`) so the pane does not collapse while
                the chunk loads. Once latched it stays mounted, preserving the
                keep-alive contract on file-tab switches. */}
            {terminalActivated && (
              // ErrorBoundary guards the chunk-fetch FETCH phase: a rejected
              // `import()` throws during render, and without a boundary React
              // unmounts the whole tree (blank app). Contained here, the shell,
              // tab strip and chat stay interactive. See change:
              // add-lazy-terminal-diff-bootstrap.
              <ErrorBoundary
                fallback={
                  <div className="min-h-0 flex-1 p-3 text-xs text-[var(--text-tertiary)]" data-testid="terminal-layer-error">
                    {t("editor.terminalLoadFailed", undefined, "Terminal failed to load.")}
                  </div>
                }
              >
                <Suspense fallback={<div className="min-h-0 flex-1" data-testid="terminal-layer-loading" />}>
                  <TerminalPaneLayer />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* Status footer */}
      {activeTab && (
        <div className="flex shrink-0 items-center gap-3 border-t border-[var(--border-primary)] px-3 py-1 text-xs text-[var(--text-tertiary)]">
          {language && <span>{language}</span>}
          <span className="truncate" title={activePath?.replace(/^diff:/, "")}>{activePath?.replace(/^diff:/, "")}</span>
        </div>
      )}
      </div>
    </div>
  );
}
