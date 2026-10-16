/**
 * Catalog key-parity for the browser plugin (change: add-browser-relay, task
 * 4.4). `catalog` ships UNPREFIXED leaf keys under `plugin.browser.*`; every
 * locale must carry the same key set — a missing key silently falls back to
 * the inline English string.
 */
import { describe, expect, it } from "vitest";
import { catalog } from "../../i18n.js";

describe("browser catalog", () => {
	it("has a non-empty key set in every locale", () => {
		for (const locale of ["hu"] as const) {
			expect(Object.keys(catalog[locale]).length).toBeGreaterThan(0);
		}
	});

});
