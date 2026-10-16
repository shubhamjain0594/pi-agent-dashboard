/**
 * Monaco text/code tab. This module is the heavy, lazily-loaded chunk: it
 * imports `monaco-editor` + `@monaco-editor/react` and bundles the editor /
 * language workers via Vite `?worker` so the pane works offline. Loaded only on
 * first text-file open (the registry wraps it in `React.lazy`).
 *
 * Read-only in v1. Inherits the dashboard's active named theme + light/dark
 * mode via `buildMonacoTheme`, recoloring live on theme/mode change.
 *
 * See change: add-internal-monaco-editor-pane (design §4, §7).
 */

import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "../../lib/api/api-context.js";
import { buildMonacoTheme } from "../../lib/theme/monaco-theme.js";
import { installPythonHighlight } from "../../lib/theme/python-highlight.js";
import { useThemeContext } from "../settings/ThemeProvider.js";
import { ensureMonacoLoader } from "./monaco-setup.js";
import type { ViewerProps } from "./types.js";
import { usePreviewFetch } from "../../lib/access-grants/preview-provenance.js";
import { useLspIntelligence } from "../../lib/lsp/use-lsp-intelligence.js";
import { useOptionalSplitWorkspace } from "../split/SplitWorkspaceContext.js";
import type * as monacoNs from "monaco-editor";

/** Map a file extension to a Monaco language id (curated allowlist). */
const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", jsonc: "json",
  py: "python", go: "go", rs: "rust",
  yaml: "yaml", yml: "yaml",
  html: "html", htm: "html", css: "css", scss: "scss", less: "less",
  sql: "sql", sh: "shell", bash: "shell", zsh: "shell",
  xml: "xml", toml: "ini", ini: "ini",
  c: "c", cc: "cpp", cpp: "cpp", h: "cpp", hpp: "cpp",
  java: "java", rb: "ruby", php: "php", lua: "lua",
};

function languageFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

export default function MonacoBuffer({ cwd, path, line }: ViewerProps) {
  ensureMonacoLoader();
  // Opted out of the access-grant dialog unless a provider declares operator
  // provenance (surface-denial-remedy-in-previews, D4).
  const { fetch: previewFetch } = usePreviewFetch();
  const { resolved, themeName } = useThemeContext();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Server omits `content` for binary/image/pdf kinds (e.g. an extension-less
  // file the client guessed as text but the server NUL-sniffed as binary).
  const [unsupported, setUnsupported] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  // Monaco instance + this buffer's model, set once on mount for the LSP hook.
  const [handles, setHandles] = useState<{ monaco: Monaco; model: monacoNs.editor.ITextModel } | null>(null);
  const split = useOptionalSplitWorkspace();
  const openDefinition = useCallback((nextPath: string, line?: number) => {
    split?.openInSplit(nextPath, line);
  }, [split]);
  const lsp = useLspIntelligence({
    cwd,
    path,
    text: content,
    monaco: handles?.monaco ?? null,
    model: handles?.model ?? null,
    onOpenFile: split ? openDefinition : undefined,
  });

  // Fetch file content.
  useEffect(() => {
    let active = true;
    setContent(null);
    setError(null);
    setUnsupported(false);
    previewFetch(`${getApiBase()}/api/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!active) return;
        if (!body.success || body.data?.type !== "file") {
          setError(body.error ?? "Failed to load file");
          return;
        }
        if (typeof body.data.content !== "string") {
          setUnsupported(true);
          return;
        }
        setContent(body.data.content);
      })
      .catch((err) => active && setError(err?.message ?? "Network error"));
    return () => {
      active = false;
    };
  }, [cwd, path, previewFetch]);

  // Re-scroll to `line` when it changes after the editor is already mounted
  // (reopening the same buffer at a different line).
  useEffect(() => {
    const ed = editorRef.current;
    if (ed && content !== null && line && line > 0) {
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: 1 });
    }
  }, [line, content]);

  // Fold the file's leading block comment (header) once its content has loaded.
  useEffect(() => {
    if (content === null) return;
    editorRef.current?.getAction("editor.foldAllBlockComments")?.run();
  }, [content]);

  // Re-apply the derived Monaco theme whenever the dashboard theme/mode changes.
  useEffect(() => {
    if (!monacoRef.current) return;
    const { name, data } = buildMonacoTheme(themeName, resolved);
    monacoRef.current.editor.defineTheme(name, data);
    monacoRef.current.editor.setTheme(name);
  }, [themeName, resolved]);

  const handleBeforeMount = (m: Monaco) => {
    // This standalone viewer has no project type environment. Keep the local
    // TS/JS worker available for navigation/hover, but suppress project errors.
    const tsDefaults = m.languages?.typescript;
    if (tsDefaults) {
      const opts = { noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true };
      tsDefaults.typescriptDefaults?.setDiagnosticsOptions(opts);
      tsDefaults.javascriptDefaults?.setDiagnosticsOptions(opts);
    }
    // Define the initial theme before first paint so the editor never flashes
    // the default vs-dark.
    installPythonHighlight(m);
    const { name, data } = buildMonacoTheme(themeName, resolved);
    m.editor.defineTheme(name, data);
  };

  const handleMount: OnMount = (editor, m) => {
    editorRef.current = editor;
    monacoRef.current = m;
    const model = editor.getModel();
    if (model) setHandles({ monaco: m, model });
    void document.fonts?.load('13px "Iosevka Extended"').then(() => m.editor.remeasureFonts()).catch(() => {});
    if (line && line > 0) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
    }
  };

  if (error) {
    return <div className="p-4 text-sm text-[var(--accent-red-text)]">{error}</div>;
  }
  if (unsupported) {
    return (
      <div className="p-4 text-sm text-[var(--text-secondary)]">
        This file is binary and can't be shown here — open it externally.
      </div>
    );
  }

  // Trust banner: only for a language a server covers, while the workspace is not trusted.
  const lspBanner =
    lsp.language && lsp.status && !lsp.status.trusted ? (
      lsp.status.available ? (
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <span className="flex-1">
            Code intelligence is off for this workspace. Trusting it lets the language server run its code.
          </span>
          <button
            type="button"
            onClick={() => void lsp.trust()}
            className="rounded px-2 py-1 text-[var(--accent-blue-text)] hover:underline"
          >
            Trust workspace
          </button>
        </div>
      ) : (
        <div className="border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
          No {lsp.language} language server is installed on this host.
        </div>
      )
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {lspBanner}
      <div className="min-h-0 flex-1">
    <Editor
      height="100%"
      theme={`pi-monaco-${themeName}-${resolved}`}
      language={languageFor(path)}
      value={content ?? ""}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      loading={<div className="p-4 text-sm text-[var(--text-tertiary)]">Loading editor…</div>}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        scrollBeyondLastLine: false,
        fontSize: 13,
        fontFamily: '"Iosevka Extended", "SFMono-Regular", Consolas, monospace',
        lineHeight: 21,
        wordWrap: "on",
        padding: { top: 12, bottom: 12 },
        lineNumbersMinChars: 3,
        folding: true,
        foldingImportsByDefault: true,
        automaticLayout: true,
        renderWhitespace: "selection",
      }}
    />
      </div>
    </div>
  );
}
