import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../monaco-setup.ts"), "utf8");
const require = createRequire(import.meta.url);

// Bootstrap wiring contract; real worker startup is covered by the browser smoke.
describe("bundled Monaco worker wiring", () => {
  it("routes TS/JS to their local language worker instead of the generic editor worker", () => {
    expect(source).toContain('import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker"');
    expect(source).toContain('if (label === "typescript" || label === "javascript") return new tsWorker()');
    expect(require.resolve("monaco-editor/language/typescript/ts.worker.js")).toMatch(/ts\.worker\.js$/);
  });
  it("keeps the generic worker for languages without a specialized service", () => {
    expect(source).toContain('if (label === "json") return new jsonWorker()');
    expect(source).toContain('return new editorWorker()');
  });
});
