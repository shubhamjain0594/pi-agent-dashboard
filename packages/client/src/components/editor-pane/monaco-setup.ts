/**
 * Shared Monaco bootstrap (side-effect import).
 *
 * Bundles the editor / language workers locally via Vite `?worker` instead of
 * @monaco-editor/react's default CDN loader, and points `@monaco-editor/react`
 * at the bundled `monaco-editor` (`loader.config`). Both `MonacoBuffer.tsx`
 * (read-only code viewer) and `MarkdownEditor.tsx` (editable markdown) import
 * this for side-effects so worker wiring lives in one place. The
 * `MonacoEnvironment` assignment is idempotent — importing from both modules is
 * safe.
 *
 * TypeScript/JavaScript require their own language worker even when diagnostic
 * output is disabled. Falling back to the generic editor worker makes Monaco
 * try loading an AMD foreign module into an ESM worker (`require.toUrl` error).
 * Worker bundles are fetched only when the corresponding language is opened.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import cssWorker from "monaco-editor/language/css/css.worker.js?worker";
import htmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

(self as unknown as { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

// `loader` lives in the monaco chunk, which imports this module while it is
// still evaluating. Calling `loader.config` here reads that export before it
// exists and the editor pane throws. Configure on first render instead.
let configured = false;
export function ensureMonacoLoader(): void {
  if (configured) return;
  configured = true;
  loader.config({ monaco });
}
