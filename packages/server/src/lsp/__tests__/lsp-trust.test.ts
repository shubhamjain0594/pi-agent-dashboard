import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLspTrustStore } from "../lsp-trust.js";

describe("LSP workspace trust store", () => {
  let dir: string;
  let root: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lsp-trust-"));
    root = path.join(dir, "ws");
    fs.mkdirSync(root);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to untrusted when no file exists", () => {
    const store = createLspTrustStore(path.join(dir, "lsp-trust.json"));
    expect(store.isTrusted(root)).toBe(false);
  });

  it("persists trust across store instances", () => {
    const file = path.join(dir, "lsp-trust.json");
    createLspTrustStore(file).setTrusted(root, true);
    expect(createLspTrustStore(file).isTrusted(root)).toBe(true);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ trustedRoots: [fs.realpathSync(root)] });
  });

  it("revokes trust", () => {
    const store = createLspTrustStore(path.join(dir, "lsp-trust.json"));
    store.setTrusted(root, true);
    store.setTrusted(root, false);
    expect(store.isTrusted(root)).toBe(false);
  });

  it("treats a symlink to a trusted root as the same root", () => {
    const link = path.join(dir, "link");
    fs.symlinkSync(root, link);
    const store = createLspTrustStore(path.join(dir, "lsp-trust.json"));
    store.setTrusted(root, true);
    expect(store.isTrusted(link)).toBe(true);
  });

  it("ignores a corrupt trust file rather than trusting everything", () => {
    const file = path.join(dir, "lsp-trust.json");
    fs.writeFileSync(file, "{not json");
    expect(createLspTrustStore(file).isTrusted(root)).toBe(false);
  });
});
