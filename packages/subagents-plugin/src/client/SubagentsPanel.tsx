/**
 * The Subagents sub-tab under Tasks: the session's run tree, like a file explorer.
 * See change: rewrite-subagent-inspector-for-pi-subagents.
 */
import { useSubagentSnapshot } from "./useSubagentData.js";
import { SubagentTree } from "./SubagentTree.js";

export interface SubagentsPanelProps {
	sessionId: string;
	onOpen: (runId: string, childId?: string) => void;
}

export function SubagentsPanel({ sessionId, onOpen }: SubagentsPanelProps) {
	const snapshot = useSubagentSnapshot(sessionId);
	return (
		<div data-testid="subagents-panel" className="p-2">
			<SubagentTree nodes={snapshot?.runs ?? []} onOpen={onOpen} />
		</div>
	);
}
