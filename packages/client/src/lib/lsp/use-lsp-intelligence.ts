/**
 * Wires language-server code intelligence into a read-only Monaco buffer.
 *
 * Status comes from `GET /api/lsp/status`. A connection opens only when the
 * workspace is trusted (the server enforces this too). The hook exposes the
 * status and a `trust()` action so the viewer can show a trust banner.
 */

import type * as monacoNs from "monaco-editor";
import { useCallback, useEffect, useState } from "react";
import { fetchLspStatus, type LspStatus, setLspTrust } from "../api/lsp-api.js";
import { logRejection } from "../report-error.js";
import { LspConnection, type LspDiagnostic, lspLanguageForPath } from "./lsp-connection.js";
import { attachLspToModel, diagnosticsToMarkers } from "./lsp-monaco.js";

type Monaco = typeof monacoNs;

export interface LspIntelligenceArgs {
  cwd: string;
  path: string;
  /** Buffer text, or null while still loading. */
  text: string | null;
  monaco: Monaco | null;
  model: monacoNs.editor.ITextModel | null;
  /** Open a definition that lives in another workspace file as an editor tab. */
  onOpenFile?: (path: string, line?: number) => void;
}

/** `file://` URI for a workspace file. Matches what the server's path guard expects. */
export function fileUriFor(cwd: string, relPath: string): string {
  const absolute = `${cwd.replace(/\/+$/, "")}/${relPath.replace(/^\/+/, "")}`;
  return `file://${encodeURI(absolute).replace(/#/g, "%23").replace(/\?/g, "%3F")}`;
}

/**
 * Workspace-relative path for a `file://` URI, or null when it is not inside
 * `cwd`. Used to turn a cross-file definition into an editor tab.
 */
export function relPathFromFileUri(cwd: string, uri: string): string | null {
  let pathname: string;
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "file:") return null;
    pathname = parsed.pathname;
  } catch {
    return null;
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* pathname was already decoded */
  }
  const root = cwd.replace(/\/+$/, "");
  if (pathname !== root && !pathname.startsWith(`${root}/`)) return null;
  const rel = pathname.slice(root.length).replace(/^\/+/, "");
  if (!rel || rel.split("/").includes("..")) return null;
  return rel;
}

/** Where a definition click should open, when it is a different workspace file. */
export function definitionOpenTarget(
  cwd: string,
  currentPath: string,
  uri: string,
  selection?: { lineNumber?: number; startLineNumber?: number; startColumn?: number } | null,
): { path: string; line?: number } | null {
  const rel = relPathFromFileUri(cwd, uri);
  if (!rel || rel === currentPath) return null;
  const line = selection?.lineNumber ?? selection?.startLineNumber;
  return { path: rel, line: line && line > 0 ? line : undefined };
}

export function useLspIntelligence({ cwd, path, text, monaco, model, onOpenFile }: LspIntelligenceArgs) {
  const language = lspLanguageForPath(path);
  const [status, setStatus] = useState<LspStatus | null>(null);

  useEffect(() => {
    setStatus(null);
    if (!language) return;
    let active = true;
    void fetchLspStatus(cwd, language)
      .then((s) => { if (active) setStatus(s); })
      .catch(logRejection("useLspIntelligence.status"));
    return () => {
      active = false;
    };
  }, [cwd, language]);

  const trusted = status?.trusted === true;

  // Cross-file "go to definition" has no model in this editor. Open that
  // path as a tab; same-file jumps stay on the current model.
  useEffect(() => {
    if (!monaco || !onOpenFile || !monaco.editor.registerEditorOpener) return;
    const disposable = monaco.editor.registerEditorOpener({
      openCodeEditor(_source, resource, selection) {
        const target = definitionOpenTarget(cwd, path, resource.toString(), selection);
        if (!target) return false;
        onOpenFile(target.path, target.line);
        return true;
      },
    });
    return () => disposable.dispose();
  }, [monaco, cwd, path, onOpenFile]);

  useEffect(() => {
    if (!language || !trusted || !monaco || !model || text === null) return;
    let active = true;
    let disposeProviders: (() => void) | undefined;
    let connection: LspConnection | null = null;
    const fileUri = fileUriFor(cwd, path);

    const onDiagnostics = (uri: string, diagnostics: LspDiagnostic[]) => {
      if (active && uri === fileUri) monaco.editor.setModelMarkers(model, "lsp", diagnosticsToMarkers(monaco, diagnostics));
    };
    const onConn = (conn: LspConnection | null) => {
      if (!conn) return;
      if (!active) {
        conn.close();
        return;
      }
      connection = conn;
      disposeProviders = attachLspToModel(monaco, conn, { language, model, fileUri, text });
    };
    void LspConnection.open({ cwd, language, onDiagnostics }).then(onConn).catch(logRejection("useLspIntelligence.connect"));

    return () => {
      active = false;
      disposeProviders?.();
      connection?.close();
    };
  }, [trusted, language, cwd, path, monaco, model, text]);

  const trust = useCallback(async () => {
    const ok = await setLspTrust(cwd, true);
    if (ok) setStatus((prev) => (prev ? { ...prev, trusted: true } : { available: true, trusted: true }));
  }, [cwd]);

  return { language, status, trust };
}
