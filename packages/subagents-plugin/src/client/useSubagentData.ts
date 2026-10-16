/**
 * Session-scoped subagent data, read from the forwarded events (latest status and
 * inspect replies). See change: rewrite-subagent-inspector-for-pi-subagents.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getSessionEvents, subscribeSessionEvents } from "@blackbelt-technology/dashboard-plugin-runtime";
import {
	type AsyncStatusNode,
	type AsyncStatusSnapshot,
	type ForwardedWidgetEvent,
	type InspectReply,
	decodeClosedRuns,
	encodeClosedRuns,
	inspectRepliesFromEvents,
	latestStatusSnapshot,
	mergeClosedRuns,
	subagentViewRuns,
} from "../shared/widget-payloads.js";

/** Per-browser storage of a session's closed runs, so they survive a reload. */
const closedKey = (sessionId: string) => `pi-dashboard-subagent-closed:${sessionId}`;

function readClosed(sessionId: string): AsyncStatusNode[] {
	try {
		return decodeClosedRuns(globalThis.localStorage?.getItem(closedKey(sessionId)) ?? null);
	} catch {
		return [];
	}
}

function writeClosed(sessionId: string, runs: readonly AsyncStatusNode[]): void {
	try {
		globalThis.localStorage?.setItem(closedKey(sessionId), encodeClosedRuns(runs));
	} catch {
		/* storage full or disabled: closed runs simply are not kept */
	}
}

/**
 * The session's forwarded events, read straight from the session-events store.
 * Unlike the plugin-context hook this needs no provider, so the editor pane can
 * use it in any tree (and in tests).
 */
function useForwardedEvents(sessionId: string): readonly ForwardedWidgetEvent[] {
	const subscribe = useCallback((cb: () => void) => subscribeSessionEvents(sessionId, cb), [sessionId]);
	const snapshot = useCallback(() => getSessionEvents(sessionId), [sessionId]);
	return useSyncExternalStore(subscribe, snapshot) as readonly ForwardedWidgetEvent[];
}

/**
 * The run tree the session shows: live runs, then closed runs (finished, kept per
 * session). Null when there is nothing to show.
 */
export function useSubagentSnapshot(sessionId: string): AsyncStatusSnapshot | null {
	const events = useForwardedEvents(sessionId);
	const live = useMemo(() => latestStatusSnapshot(events), [events]);
	const closed = useMemo(() => mergeClosedRuns(readClosed(sessionId), live), [sessionId, live]);
	useEffect(() => {
		if (closed.length > 0) writeClosed(sessionId, closed);
	}, [sessionId, closed]);
	return useMemo(() => {
		const runs = subagentViewRuns(live, closed);
		if (runs.length === 0) return null;
		return { kind: "pi-subagents.async-status-snapshot", version: 1, runs } as AsyncStatusSnapshot;
	}, [live, closed]);
}

/** Inspect replies of the session, keyed by requestId. */
export function useInspectReplies(sessionId: string): Map<string, InspectReply> {
	const events = useForwardedEvents(sessionId);
	return useMemo(() => inspectRepliesFromEvents(events), [events]);
}
