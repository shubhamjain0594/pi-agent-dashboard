import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../styles/workbench.css"), "utf8");

describe("workbench typography", () => {
  it("bundles variable fonts locally instead of depending on system installs or a font CDN", () => {
    expect(css).toContain('@fontsource-variable/inter/files/inter-latin-standard-normal.woff2');
    expect(css).toContain('@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2');
    expect(css.match(/font-display: swap/g)).toHaveLength(4);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it("keeps UI and technical typography separate with usable fallbacks", () => {
    expect(css).toMatch(/--workbench-font-sans:\s*"Inter Variable"[^;]*sans-serif/);
    expect(css).toMatch(/--workbench-font-mono:\s*"JetBrains Mono Variable"[^;]*monospace/);
    expect(css).toContain("font-family: var(--workbench-font-sans)");
    expect(css).toContain("font-family: var(--workbench-font-mono)");
    expect(css).toContain("font-variant-numeric: tabular-nums");
  });
});
