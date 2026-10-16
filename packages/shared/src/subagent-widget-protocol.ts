/**
 * Shared protocol for forwarding pi-subagents' widget lines to the dashboard.
 *
 * The main bridge (extension package) turns a `setWidget(key, lines)` call for a
 * key below into a plugin event-forward channel. The subagents plugin bridge
 * declares the same channels, so the server forwards them to the browser.
 * Both sides import this file, so the names cannot drift.
 * See change: rewrite-subagent-inspector-for-pi-subagents.
 */

/** pi-subagents' live status widget. */
export const SUBAGENT_STATUS_WIDGET_KEY = "subagent-async";
/** pi-subagents' on-demand inspect reply widget. */
export const SUBAGENT_INSPECT_WIDGET_KEY = "subagent-inspect";

/**
 * Payload field that groups forwarded lines by widget. Non-live channels must
 * declare a key, and the key value must be a scalar, so the widget key travels as
 * `widget` (e.g. `{widget: "subagent-async", lines: [...]}`).
 */
export const SUBAGENT_WIDGET_KEY_FIELD = "widget";

/** Widget key → event-forward channel. */
export const SUBAGENT_WIDGET_CHANNELS: Readonly<Record<string, string>> = {
	[SUBAGENT_STATUS_WIDGET_KEY]: "subagents:status",
	[SUBAGENT_INSPECT_WIDGET_KEY]: "subagents:inspect",
};

/** Keys whose lines are forwarded. */
export const SUBAGENT_WIDGET_KEYS: ReadonlySet<string> = new Set(Object.keys(SUBAGENT_WIDGET_CHANNELS));

/** Channel → event type seen by the browser. */
export const SUBAGENT_WIDGET_FORWARD_AS: Readonly<Record<string, string>> = {
	"subagents:status": "subagent_status",
	"subagents:inspect": "subagent_inspect",
};
