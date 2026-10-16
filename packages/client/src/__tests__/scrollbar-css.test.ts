/**
 * Scrollbar contract: thin, theme-blended `::-webkit-scrollbar` app-wide.
 * Chromium 121+ ignores `::-webkit-scrollbar` on any element that sets
 * `scrollbar-width` / `scrollbar-color`, so those may only appear inside the
 * Firefox-only `@supports not selector(::-webkit-scrollbar)` fallback.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = path.resolve(__dirname, "..");
const stylesDir = path.join(srcDir, "styles");
// Comments may explain scrollbar-width/color; only real declarations count.
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const indexCss = stripComments(fs.readFileSync(path.join(srcDir, "index.css"), "utf8"));
const FALLBACK = /@supports not selector\(::-webkit-scrollbar\)\s*\{[\s\S]*?\}\s*\}/;

const styleFiles = fs
  .readdirSync(stylesDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => ({ name: f, css: stripComments(fs.readFileSync(path.join(stylesDir, f), "utf8")) }));

describe("app-wide thin scrollbar", () => {
  it("defines a 6px webkit thumb with a transparent track", () => {
    expect(indexCss).toMatch(/\*::-webkit-scrollbar\s*\{\s*width:\s*6px;\s*height:\s*6px;\s*\}/);
    expect(indexCss).toMatch(/\*::-webkit-scrollbar-track\s*,?[^{]*\{\s*background:\s*transparent;?\s*\}/);
  });

  it("strengthens the thumb when its scroller is hovered", () => {
    expect(indexCss).toMatch(/\*:hover::-webkit-scrollbar-thumb\s*\{/);
  });

  it("keeps scrollbar-width/color only inside the Firefox fallback", () => {
    expect(indexCss).toMatch(FALLBACK);
    expect(indexCss.replace(FALLBACK, "")).not.toMatch(/scrollbar-(width|color)/);
  });

  it("no styles/*.css file overrides scrollbar-width/color (would disable the thin thumb)", () => {
    for (const { name, css } of styleFiles) {
      expect(css, name).not.toMatch(/scrollbar-(width|color)/);
    }
  });

  it("conversation scrollport keeps its stable gutter", () => {
    expect(indexCss).toMatch(/\.conversation-scrollport\s*\{[^}]*scrollbar-gutter:\s*stable/);
  });
});
