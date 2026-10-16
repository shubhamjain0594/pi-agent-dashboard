/**
 * `.html` tab: Source (read-only Monaco) by default, Preview toggles to the
 * sandboxed `HtmlPreview` (scripts disabled). A canvas auto-open (`restrictCsp`)
 * opens on Preview so the rendered artifact shows without a click.
 */
import { mdiCodeTags, mdiEyeOutline } from "@mdi/js";
import { Icon } from "@mdi/react";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { t as i18nT } from "../../lib/i18n/i18n.js";
import { HtmlPreview } from "../preview/HtmlPreview.js";
import type { ViewerProps } from "./types.js";

const MonacoBuffer = lazy(() => import("./MonacoBuffer.js"));

type Mode = "source" | "preview";

function ModeButton({ testId, active, icon, label, onClick }: { testId: string; active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex items-center gap-1 rounded px-2 py-0.5",
        active ? "bg-[var(--bg-selected)] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]",
      ].join(" ")}
    >
      <Icon path={icon} size={0.55} />
      <span>{label}</span>
    </button>
  );
}

export function HtmlTab(props: ViewerProps) {
  const { cwd, path, restrictCsp } = props;
  const [mode, setMode] = useState<Mode>(restrictCsp ? "preview" : "source");

  const body: ReactNode =
    mode === "source" ? (
      <Suspense fallback={<div className="p-4 text-sm text-[var(--text-tertiary)]">{i18nT("status.loadingEditor", undefined, "Loading editor…")}</div>}>
        <MonacoBuffer {...props} />
      </Suspense>
    ) : (
      <HtmlPreview target={{ kind: "file", cwd, path }} restrictCsp={restrictCsp} />
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border-primary)] px-2 py-1 text-xs">
        <ModeButton
          testId="html-source-toggle"
          active={mode === "source"}
          icon={mdiCodeTags}
          label={i18nT("editor.source", undefined, "Source")}
          onClick={() => setMode("source")}
        />
        <ModeButton
          testId="html-preview-toggle"
          active={mode === "preview"}
          icon={mdiEyeOutline}
          label={i18nT("editor.preview", undefined, "Preview")}
          onClick={() => setMode("preview")}
        />
      </div>
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}
