/**
 * File-explorer style tree of pi-subagents runs: each run is a folder, its
 * children are nested subfolders. A chevron expands or collapses a node; the
 * label opens it (run id, plus child id when the node is a child).
 * See change: rewrite-subagent-inspector-for-pi-subagents.
 */
import { useState } from "react";
import { useT } from "@blackbelt-technology/dashboard-plugin-runtime";
import type { AsyncStatusNode } from "../shared/widget-payloads.js";

export interface SubagentTreeProps {
	nodes: AsyncStatusNode[];
	onOpen: (runId: string, childId?: string) => void;
}

interface LevelProps {
	nodes: AsyncStatusNode[];
	/** Run id at the top of this branch (undefined at the top level). */
	rootId?: string;
	expanded: Set<string>;
	toggle: (id: string) => void;
	onOpen: (runId: string, childId?: string) => void;
}

function Level({ nodes, rootId, expanded, toggle, onOpen }: LevelProps) {
	const t = useT();
	return (
		<ul className="flex flex-col gap-0.5 pl-3" role="tree">
			{nodes.map((node) => {
				const id = typeof node.id === "string" ? node.id : "";
				const children = Array.isArray(node.children) ? node.children : [];
				const isOpen = expanded.has(id);
				const label = node.label ?? id;
				const runId = rootId ?? id;
				const childId = rootId === undefined ? undefined : id;
				return (
					<li key={id} role="treeitem" aria-expanded={children.length > 0 ? isOpen : undefined}>
						<div className="flex items-center gap-1 text-[12px]">
							{children.length > 0 ? (
								<button type="button" data-testid={`tree-toggle-${id}`} aria-label={isOpen ? "Collapse" : "Expand"} onClick={() => toggle(id)} className="w-4 text-[var(--text-muted)]">
									{isOpen ? "▾" : "▸"}
								</button>
							) : (
								<span className="w-4" />
							)}
							<button type="button" onClick={() => onOpen(runId, childId)} className="truncate text-left text-[var(--text-primary)] hover:underline">
								{label}
							</button>
							{node.state && <span className="text-[10px] text-[var(--text-tertiary)]">{node.ended ? t("closed", undefined, "closed") : node.state}</span>}
						</div>
						{children.length > 0 && isOpen && (
							<Level nodes={children} rootId={runId} expanded={expanded} toggle={toggle} onOpen={onOpen} />
						)}
					</li>
				);
			})}
		</ul>
	);
}

export function SubagentTree({ nodes, onOpen }: SubagentTreeProps) {
	const t = useT();
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
	const toggle = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	if (nodes.length === 0) {
		return <div className="text-[11px] text-[var(--text-muted)]">{t("noRuns", undefined, "No subagent runs yet.")}</div>;
	}
	return <Level nodes={nodes} expanded={expanded} toggle={toggle} onOpen={onOpen} />;
}
