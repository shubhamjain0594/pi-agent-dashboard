/**
 * Forward pi-subagents' live widget lines to the dashboard.
 *
 * In RPC (dashboard-spawned) sessions pi turns `ctx.ui.setWidget(key, lines)` into
 * a stdout event the server does not consume. We wrap `setWidget` for the two keys
 * the subagents plugin needs and emit their lines on the matching event-forward
 * channel (see shared `subagent-widget-protocol`). The plugin bridge declares the
 * channels; the server forwards them to the browser. The original `setWidget` is
 * always called, so the TUI and other extensions are unaffected.
 *
 * See change: rewrite-subagent-inspector-for-pi-subagents.
 */
import { SUBAGENT_WIDGET_CHANNELS, SUBAGENT_WIDGET_KEY_FIELD } from "@blackbelt-technology/pi-dashboard-shared/subagent-widget-protocol.js";

export interface SubagentWidgetForwardDeps {
	/** True only for RPC (dashboard-spawned) sessions. */
	isRpc: () => boolean;
	/** Emit on the pi event bus (the main bridge forwards declared channels). */
	emit: (channel: string, payload: Record<string, unknown>) => void;
}

type SetWidget = (...args: any[]) => unknown;

/** ui objects already wrapped; a second install on the same object is a no-op. */
const wrapped = new WeakSet<object>();

export function wrapSubagentWidgetForward(
	ui: { setWidget?: SetWidget } | undefined,
	deps: SubagentWidgetForwardDeps,
): void {
	if (!ui || typeof ui.setWidget !== "function" || wrapped.has(ui)) return;
	wrapped.add(ui);
	const original = ui.setWidget.bind(ui);
	ui.setWidget = (...args) => {
		const [key, content] = args as [string, unknown, ...unknown[]];
		const channel = Object.prototype.hasOwnProperty.call(SUBAGENT_WIDGET_CHANNELS, key) ? SUBAGENT_WIDGET_CHANNELS[key] : undefined;
		// `undefined` is pi-subagents' clear: emit it as an empty list.
		if (channel && (Array.isArray(content) || content === undefined) && deps.isRpc()) {
			deps.emit(channel, { [SUBAGENT_WIDGET_KEY_FIELD]: key, lines: content ?? [] });
		}
		// Delegate the exact argument list, so the original sees what pi sent.
		return original(...args);
	};
}

/**
 * True when pi was launched in RPC mode (`--mode rpc` or `--mode=rpc`). Read from
 * the launch argv: pi reports `ctx.hasUI === true` in RPC mode, so hasUI cannot
 * tell RPC from TUI. Exact-token match, like the bridge's `--model` gate.
 */
export function isRpcLaunch(argv: readonly string[]): boolean {
	return argv.some((arg, i) => (arg === "--mode" && argv[i + 1] === "rpc") || arg === "--mode=rpc");
}
