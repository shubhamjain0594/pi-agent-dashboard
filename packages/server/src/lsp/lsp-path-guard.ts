/**
 * Workspace containment for LSP document URIs. A client may only open, change,
 * or query files whose real path (symlinks resolved) lies under the trusted
 * workspace root.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeRealpathSync } from "../resolve-path.js";

/** True when `uri` is a `file://` URI whose real path is inside `root`. */
export function isFileUriInsideRoot(uri: unknown, root: string): boolean {
  if (typeof uri !== "string" || !uri.startsWith("file://")) return false;
  let filePath: string;
  try {
    filePath = fileURLToPath(uri);
  } catch {
    return false;
  }
  const realRoot = safeRealpathSync(path.resolve(root));
  // A missing file keeps its literal path (safeRealpathSync falls back), so it
  // is judged lexically; an existing symlink is judged by its target.
  const realFile = safeRealpathSync(path.resolve(filePath));
  const rel = path.relative(realRoot, realFile);
  if (rel === "" || path.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}
