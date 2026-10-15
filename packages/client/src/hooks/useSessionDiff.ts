/**
 * Hook to fetch session file diff data from the server.
 */

import type { SessionDiffResponse } from "@blackbelt-technology/pi-dashboard-shared/diff-types.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api/api-context.js";
import { t } from "../lib/i18n/i18n.js";
import { logRejection } from "../lib/report-error.js";

export interface UseSessionDiffResult {
  data: SessionDiffResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSessionDiff(sessionId: string | undefined): UseSessionDiffResult {
  const [state, setState] = useState<{ sessionId: string | undefined; data: SessionDiffResponse | null; isLoading: boolean; error: string | null }>({ sessionId, data: null, isLoading: false, error: null });
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const currentSession = useRef(sessionId);
  currentSession.current = sessionId;

  const fetchDiff = useCallback(async () => {
    if (!sessionId) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const revision = ++request.current;
    const isCurrent = () => !abort.signal.aborted && request.current === revision && currentSession.current === sessionId;
    setState(previous => ({ sessionId, data: previous.sessionId === sessionId ? previous.data : null, isLoading: true, error: null }));
    try {
      const res = await fetch(`${getApiBase()}/api/session-diff?sessionId=${encodeURIComponent(sessionId)}`, { signal: abort.signal });
      if (res.ok === false) throw new Error(t("diff.httpFailed", { status: res.status }, `Could not load changes (HTTP ${res.status}).`));
      const body = await res.json();
      if (!isCurrent()) return;
      if (body.success && Array.isArray(body.data?.files)) {
        setState({ sessionId, data: body.data as SessionDiffResponse, isLoading: false, error: null });
      } else {
        throw new Error(typeof body.error === "string" ? body.error : t("diff.fetchFailed", undefined, "Failed to fetch diff data"));
      }
    } catch (err: unknown) {
      if (!isCurrent()) return;
      setState(previous => ({ sessionId, data: previous.sessionId === sessionId ? previous.data : null, isLoading: false, error: err instanceof Error ? err.message : t("diff.fetchFailed", undefined, "Failed to fetch diff data") }));
    }
  }, [sessionId]);

  // Fetch on mount and when sessionId changes
  useEffect(() => {
    // Effect callbacks must return void/cleanup, so the promise is discarded
    // with a stated handler. See change: cleanup-client-plugin-promises.
    void fetchDiff().catch(logRejection("useSessionDiff.fetch"));
    return () => { request.current++; controller.current?.abort(); };
  }, [fetchDiff]);

  return state.sessionId === sessionId
    ? { data: state.data, isLoading: state.isLoading, error: state.error, refresh: fetchDiff }
    : { data: null, isLoading: Boolean(sessionId), error: null, refresh: fetchDiff };
}
