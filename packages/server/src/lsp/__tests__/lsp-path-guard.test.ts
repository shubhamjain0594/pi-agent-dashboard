import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isFileUriInsideRoot } from "../lsp-path-guard.js";

describe("isFileUriInsideRoot", () => {
  let dir: string;
  let root: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lsp-guard-"));
    root = path.join(dir, "ws");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export {};\n");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const uri = (p: string) => pathToFileURL(p).href;

  it("admits a file inside the root", () => {
    expect(isFileUriInsideRoot(uri(path.join(root, "src", "a.ts")), root)).toBe(true);
  });

  it("refuses a file outside the root", () => {
    expect(isFileUriInsideRoot(uri(path.join(dir, "secret.txt")), root)).toBe(false);
  });

  it("refuses traversal that lexically escapes the root", () => {
    expect(isFileUriInsideRoot(uri(path.join(root, "..", "secret.txt")), root)).toBe(false);
  });

  it("refuses a symlink inside the root that points outside it", () => {
    const outside = path.join(dir, "outside.txt");
    fs.writeFileSync(outside, "x");
    fs.symlinkSync(outside, path.join(root, "escape.txt"));
    expect(isFileUriInsideRoot(uri(path.join(root, "escape.txt")), root)).toBe(false);
  });

  it("refuses the root directory itself", () => {
    expect(isFileUriInsideRoot(uri(root), root)).toBe(false);
  });

  it("refuses non-file schemes and non-string values", () => {
    expect(isFileUriInsideRoot("https://example.com/a.ts", root)).toBe(false);
    expect(isFileUriInsideRoot(undefined, root)).toBe(false);
    expect(isFileUriInsideRoot(42, root)).toBe(false);
  });

  it("does not confuse a sibling directory sharing the root's prefix", () => {
    const sibling = path.join(dir, "ws-evil");
    fs.mkdirSync(sibling);
    fs.writeFileSync(path.join(sibling, "x.ts"), "");
    expect(isFileUriInsideRoot(uri(path.join(sibling, "x.ts")), root)).toBe(false);
  });
});
