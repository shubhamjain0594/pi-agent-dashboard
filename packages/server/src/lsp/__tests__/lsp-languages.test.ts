import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLspLanguage, lspLanguageForPath, resolveLspCommand } from "../lsp-languages.js";

describe("LSP language mapping", () => {
  it("maps TypeScript/JavaScript extensions to typescript", () => {
    for (const f of ["a.ts", "b.tsx", "c.mjs", "d.jsx", "e.cts"]) {
      expect(lspLanguageForPath(f)).toBe("typescript");
    }
  });

  it("maps .py to python and leaves other files unmapped", () => {
    expect(lspLanguageForPath("tool.py")).toBe("python");
    expect(lspLanguageForPath("README.md")).toBeNull();
    expect(lspLanguageForPath("main.go")).toBeNull();
  });

  it("accepts only supported language ids", () => {
    expect(isLspLanguage("typescript")).toBe(true);
    expect(isLspLanguage("python")).toBe(true);
    expect(isLspLanguage("rust")).toBe(false);
  });
});

describe("resolveLspCommand", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lsp-bin-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("runs the TypeScript 7 native language server (`tsc --lsp --stdio`) under the current Node binary", () => {
    const cmd = resolveLspCommand("typescript");
    expect(cmd).not.toBeNull();
    expect(cmd?.command).toBe(process.execPath);
    expect(cmd?.args).toContain("--lsp");
    expect(cmd?.args.at(-1)).toBe("--stdio");
    expect(cmd?.args[0]).toMatch(/typescript-7[\\/]bin[\\/]tsc$/);
  });

  it("finds ty on PATH and runs `ty server`", () => {
    const ty = path.join(dir, "ty");
    fs.writeFileSync(ty, "#!/bin/sh\n");
    fs.chmodSync(ty, 0o755);
    expect(resolveLspCommand("python", dir)).toEqual({ command: ty, args: ["server"] });
  });

  it("returns null when ty is not on PATH", () => {
    expect(resolveLspCommand("python", dir)).toBeNull();
  });
});
