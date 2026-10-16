/**
 * Per-workspace trust for language-server code intelligence.
 *
 * A language server (tsserver especially) executes code from the workspace it
 * is pointed at, so a workspace must be explicitly trusted before the bridge
 * starts a server for it. Trusted roots persist in
 * `~/.pi/dashboard/lsp-trust.json` as `{ "trustedRoots": [...] }`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { safeRealpathSync } from "../resolve-path.js";

export interface LspTrustStore {
  isTrusted(root: string): boolean;
  setTrusted(root: string, trusted: boolean): void;
}

export function defaultLspTrustFile(): string {
  return path.join(os.homedir(), ".pi", "dashboard", "lsp-trust.json");
}

/** Canonical key for a workspace root (absolute, symlinks resolved). */
export function normalizeWorkspaceRoot(root: string): string {
  return safeRealpathSync(path.resolve(root));
}

export function createLspTrustStore(filePath: string = defaultLspTrustFile()): LspTrustStore {
  const read = (): string[] => {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { trustedRoots?: unknown };
      return Array.isArray(parsed.trustedRoots) ? parsed.trustedRoots.filter((r): r is string => typeof r === "string") : [];
    } catch {
      return [];
    }
  };
  const write = (roots: string[]): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ trustedRoots: roots }, null, 2));
    fs.renameSync(tmp, filePath);
  };
  return {
    isTrusted(root) {
      return read().includes(normalizeWorkspaceRoot(root));
    },
    setTrusted(root, trusted) {
      const key = normalizeWorkspaceRoot(root);
      const roots = new Set(read());
      if (trusted) roots.add(key);
      else roots.delete(key);
      write([...roots].sort());
    },
  };
}
