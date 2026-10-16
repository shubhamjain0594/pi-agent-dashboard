/**
 * P2 (task 10.49) — render: build budget (size).
 *
 * The fixture deck's `deck.html` must stay ≤ 3,670,016 bytes (3.5 MiB). Rendering
 * the committed `fixtures/strategy-lab.json` is byte-equivalent to building
 * `fixtures/strategy-lab.md`, and needs no browser.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DeckIR } from "../../ir/types.js";
import { ensureRuntime, loadLocalEffects, renderDeck } from "../index.js";

/**
 * Deck size guard. 2.75 MiB fit three 0.160. The pi/openspec floor raise
 * moved the inlined runtime to three 0.186.1; the strategy-lab deck measured
 * 3,270,482 bytes on CI. 3.5 MiB leaves ~390 KB of headroom and still fails
 * a runaway bundle.
 */
const MAX_DECK_BYTES = 3_670_016;

const IR = JSON.parse(readFileSync(new URL("../../../fixtures/strategy-lab.json", import.meta.url), "utf8")) as DeckIR;

describe("P2 fixture deck size budget", () => {
  it("deck.html stays within 3,670,016 bytes", async () => {
    const html = renderDeck(IR, { runtime: await ensureRuntime() });
    expect(Buffer.byteLength(html)).toBeLessThanOrEqual(MAX_DECK_BYTES);
  }, 60_000);
});

/**
 * test-plan #P1 — the second fixture is the realistic one: ten slides carrying
 * six local effect modules, built topologies and both mermaid kinds. Its
 * embedded bytes are the budget that matters for a deck an agent actually ships.
 */
describe("P1 business fixture size budget", () => {
  const MAX_BUSINESS_BYTES = 6_291_456;

  it("deck.html stays within 6,291,456 bytes", async () => {
    const jsonPath = new URL("../../../fixtures/business-2031/deck.json", import.meta.url).pathname;
    const ir = JSON.parse(readFileSync(jsonPath, "utf8")) as DeckIR;
    const html = renderDeck(ir, {
      runtime: await ensureRuntime(),
      localFx: loadLocalEffects(ir, jsonPath),
    });
    expect(Buffer.byteLength(html)).toBeLessThanOrEqual(MAX_BUSINESS_BYTES);
  }, 60_000);
});
