import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../styles/workbench.css"), "utf8");
// Match a selector only where a rule starts (line start), so `.a > .b {` does not
// satisfy a lookup for `.b`.
const rule = (selector: string) => {
  const start = css.search(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`));
  return css.slice(start).split("}")[0];
};

describe("workbench spacing", () => {
  it("uses a shared inset for sidebar headings, search, and project navigation", () => {
    expect(css).toContain("--workbench-sidebar-inset: 12px");
    for (const selector of [".workspace-explorer-heading", ".workspace-explorer-search", ".workspace-explorer-label", ".workspace-explorer-tree"]) {
      expect(rule(selector)).toContain("var(--workbench-sidebar-inset)");
    }
  });

  it("aligns project actions and indents child sessions using stable grid columns", () => {
    expect(rule(".workspace-explorer-folder")).toContain("grid-template-columns: 16px minmax(0, 1fr) auto 24px");
    expect(rule(".workspace-explorer-session")).toContain("grid-template-columns: 8px minmax(0, 1fr) auto");
    expect(rule(".workspace-explorer-session")).toContain("padding: 6px 8px 6px 48px");
  });

  it("bounds the workspace gutter and keeps within-row spacing tighter than section spacing", () => {
    expect(rule(".workspace-overview-inner")).toContain("clamp(24px, 3vw, 40px)");
    expect(rule(".workspace-session-copy")).toContain("gap: 4px");
    expect(rule(".workspace-columns")).toContain("gap: 24px");
  });
});
