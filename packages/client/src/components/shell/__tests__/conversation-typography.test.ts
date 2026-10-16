import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../styles/conversation.css"), "utf8");

describe("conversation typography and rhythm", () => {
  it("defines one compact reading scale instead of unrelated per-element sizes", () => {
    expect(css).toContain("--conversation-font-size: 14px");
    expect(css).toContain("--conversation-line-height: 1.6");
    expect(css).toContain("--conversation-paragraph-gap: 12px");
    expect(css).toContain("font-size: var(--conversation-font-size)");
    expect(css).toContain("line-height: var(--conversation-line-height)");
  });

  it("moves assistant actions out of document flow while retaining keyboard access", () => {
    expect(css).toMatch(/\.conversation-assistant-message > \.conversation-message-actions\s*\{[^}]*position: absolute/);
    expect(css).toContain(".conversation-message:focus-within > .conversation-message-actions");
    expect(css).toContain("@media (hover: none)");
  });

  it("keeps both split stop controls equally tall on desktop and touch devices", () => {
    const [desktop, touch] = css.split("@media (pointer: coarse)");
    for (const [rules, size] of [[desktop, 32], [touch, 44]] as const) {
      const afterTurn = rules.match(/\[data-testid="stop-after-turn-button"\]\s*\{([^}]+)\}/)?.[1];
      expect(afterTurn).toContain(`height: ${size}px`);
      expect(afterTurn).toContain(`min-height: ${size}px`);
      expect(afterTurn).not.toContain("width:");
      expect(rules).toMatch(new RegExp(`\\[data-testid="stop-button"\\][^{]+\\{[^}]*height: ${size}px; min-height: ${size}px`));
    }
  });

  it("keeps small user cards and restrained heading sizes", () => {
    expect(css).toContain("--conversation-user-padding: 8px 12px");
    expect(css).toContain("padding: var(--conversation-user-padding)");
    expect(css).toContain("--conversation-heading-size: 15px");
  });
});
