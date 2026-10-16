/**
 * Supported LSP languages, file-extension mapping, and language-server command
 * resolution. Only `typescript` (TypeScript 7 native server, `tsc --lsp --stdio`
 * via the `typescript-7` alias) and `python` (`ty server`, found on PATH) are
 * wired; anything else is refused.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const LSP_LANGUAGES = ["typescript", "python"] as const;
export type LspLanguage = (typeof LSP_LANGUAGES)[number];

export function isLspLanguage(value: string): value is LspLanguage {
  return (LSP_LANGUAGES as readonly string[]).includes(value);
}

const EXT_LANGUAGE: Record<string, LspLanguage> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "typescript", jsx: "typescript", mjs: "typescript", cjs: "typescript",
  py: "python",
};

/** Language for a file path, or null when no LSP covers it. */
export function lspLanguageForPath(filePath: string): LspLanguage | null {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return EXT_LANGUAGE[ext] ?? null;
}

export interface LspCommand {
  command: string;
  args: string[];
}

function findOnPath(binary: string, pathEnv: string | undefined = process.env.PATH): string | null {
  for (const dir of (pathEnv ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, binary);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* not here — keep searching */
    }
  }
  return null;
}

/**
 * Command that starts the language server over stdio, or null when the server
 * is not installed. `typescript` runs the TypeScript 7 `tsc` wrapper (resolved
 * by package path, like `scripts/tsc7.mjs`) under the current Node binary;
 * `python` needs `ty` on PATH.
 */
export function resolveLspCommand(language: LspLanguage, pathEnv?: string): LspCommand | null {
  if (language === "typescript") {
    try {
      const require = createRequire(import.meta.url);
      const pkgJson = require.resolve("typescript-7/package.json");
      const bin = JSON.parse(fs.readFileSync(pkgJson, "utf8")).bin;
      const tsc = path.join(path.dirname(pkgJson), typeof bin === "string" ? bin : bin.tsc);
      return { command: process.execPath, args: [tsc, "--lsp", "--stdio"] };
    } catch {
      return null;
    }
  }
  const ty = findOnPath("ty", pathEnv);
  return ty ? { command: ty, args: ["server"] } : null;
}
