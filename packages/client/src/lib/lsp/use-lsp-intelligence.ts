/**
 * Wires language-server code intelligence into a read-only Monaco buffer.
 *
 * Status comes from `GET /api/lsp/status`. A connection opens only when the
 * workspace is trusted (the server enforces this too). The hook exposes the
 * status and a `trust()` action so the viewer can show a trust banner.
 */
import { useCallback, useEffect, useState } from "react";
import type * as monacoNs from "monaco-editor";
import { fetchLspStatus, type LspStatus, setLspTrust } from "../api/lsp-api.js";
import { LspConnection, lspLanguageForPath } from "./lsp-connection.js";
import { attachLspToModel, diagnosticsToMarkers } from "./lsp-monaco.js";

type Monaco = typeof monacoNs;

export interface LspIntelligenceArgs {
  cwd: string;
  path: string;
  /** Buffer text, or null while still loading. */
  text: string | null;
  monaco: Monaco | null;
  model: monacoNs.editor.ITextModel | null;
}

/** `file://` URI for a workspace file. Matches what the server's path guard expects. */
export function fileUriFor(cwd: string, relPath: string): string {
  const absolute = `${cwd.replace(/\/+$/, "")}/${relPath.replace(/^\/+/, "")}`;
  return `file://${encodeURI(absolute).replace(/#/g, "%23").replace(/\?/g, "%3F")}`;
}

export function useLspIntelligence({ cwd, path, text, monaco, model }: LspIntelligenceArgs) {
  const language = lspLanguageForPath(path);
  const [status, setStatus] = useState<LspStatus | null>(null);

  useEffect(() => {
    setStatus(null);
    if (!language) return;
    let active = true;
    fetchLspStatus(cwd, language).then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, [cwd, language]);

  const trusted = status?.trusted === true;

  useEffect(() => {
    if (!language || !trusted || !monaco || !model || text === null) return;
    let active = true;
    let disposeProviders: (() => void) | undefined;
    let connection: LspConnection | null = null;
    const fileUri = fileUriFor(cwd, path);

    LspConnection.open({
      cwd,
      language,
      onDiagnostics: (uri, diagnostics) => {
        if (active && uri === fileUri) monaco.editor.setModelMarkers(model, "lsp", diagnosticsToMarkers(monaco, diagnostics));
      },
    }).then((conn) => {
      if (!conn) return;
      if (!active) {
        conn.close();
        return;
      }
      connection = conn;
      disposeProviders = attachLspToModel(monaco, conn, { language, model, fileUri, text });
    });

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
