/**
 * Inspector for one subagent run or child. Sends `/subagents-inspect-rpc` to the
 * session and shows the reply that carries the same requestId. Read-only, like
 * pi's own inspect command. See change: rewrite-subagent-inspector-for-pi-subagents.
 */
import { useEffect, useRef, useState } from "react";
import { useT } from "@blackbelt-technology/dashboard-plugin-runtime";
import type { InspectReply } from "../shared/widget-payloads.js";

export const DEFAULT_INSPECT_LINES = 50;

export function buildInspectCommand(args: { requestId: string; asyncId: string; childId?: string; lines: number }): string {
	const parts = ["/subagents-inspect-rpc", args.requestId, args.asyncId];
	if (args.childId) parts.push(args.childId);
	parts.push("--lines", String(args.lines));
	return parts.join(" ");
}

/** requestId matching pi-subagents' `^[A-Za-z0-9_-]{1,64}$`. */
function newRequestId(): string {
	return `rq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SubagentInspectViewProps {
	asyncId: string;
	childId?: string;
	replies: Map<string, InspectReply>;
	/** Sends text into the session; returns false when the session is not connected. */
	onSend: (text: string) => boolean;
	onBack: () => void;
}

export function SubagentInspectView({ asyncId, childId, replies, onSend, onBack }: SubagentInspectViewProps) {
	const t = useT();
	const [requestId, setRequestId] = useState<string>(() => newRequestId());
	const sentRef = useRef<string | null>(null);
	const [sendFailed, setSendFailed] = useState(false);

	useEffect(() => {
		if (sentRef.current === requestId) return;
		sentRef.current = requestId;
		const ok = onSend(buildInspectCommand({ requestId, asyncId, childId, lines: DEFAULT_INSPECT_LINES }));
		setSendFailed(!ok);
		// onSend is intentionally read once per request: a new render must not resend.
	}, [requestId, asyncId, childId, onSend]);

	const reply = replies.get(requestId);
	const refresh = () => setRequestId(newRequestId());

	return (
		<div className="flex flex-col gap-2 p-3 text-[12px]">
			<div className="flex items-center gap-2">
				<button type="button" data-testid="inspect-back" onClick={onBack} className="text-[var(--text-muted)] hover:underline">
					{t("back", undefined, "← Back")}
				</button>
				<button type="button" data-testid="inspect-refresh" onClick={refresh} className="text-[var(--text-muted)] hover:underline">
					{t("refresh", undefined, "Refresh")}
				</button>
			</div>
			{sendFailed && <div className="text-[var(--text-danger)]">{t("notConnected", undefined, "The session is not connected.")}</div>}
			{!reply && !sendFailed && (
				<div data-testid="inspect-waiting" className="text-[var(--text-muted)]">
					{t("waitingForReply", undefined, "Waiting for pi to answer…")}
				</div>
			)}
			{reply?.error && <div className="text-[var(--text-danger)]">{reply.error.message}</div>}
			{reply && !reply.error && (
				<>
					{reply.label && <div className="font-medium">{reply.label}</div>}
					{reply.status && <div className="text-[var(--text-tertiary)]">{reply.status}</div>}
					{reply.task && (
						<section>
							<div className="text-[11px] text-[var(--text-muted)]">{t("task", undefined, "Task")}</div>
							<pre className="whitespace-pre-wrap">{reply.task}</pre>
						</section>
					)}
					{reply.messages && reply.messages.length > 0 && (
						<section className="flex flex-col gap-1">
							<div className="text-[11px] text-[var(--text-muted)]">{t("transcript", undefined, "Transcript")}</div>
							{reply.messages.map((m, i) => (
								<div key={i} className={m.isError ? "text-[var(--text-danger)]" : ""}>
									<span className="text-[var(--text-tertiary)]">{m.role ?? ""} </span>
									<span className="whitespace-pre-wrap">{m.text ?? ""}</span>
								</div>
							))}
						</section>
					)}
					{reply.finalOutput && (
						<section>
							<div className="text-[11px] text-[var(--text-muted)]">{t("finalOutput", undefined, "Final output")}</div>
							<pre className="whitespace-pre-wrap">{reply.finalOutput}</pre>
						</section>
					)}
					{reply.truncated && <div className="text-[10px] text-[var(--text-tertiary)]">{t("truncatedNote", undefined, "Some content was truncated by pi.")}</div>}
				</>
			)}
		</div>
	);
}
