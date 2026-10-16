import { describe, expect, it, vi } from "vitest";
import { fileUriFor } from "../use-lsp-intelligence.js";
import { lspLanguageForPath } from "../lsp-connection.js";
import { attachLspToModel, diagnosticsToMarkers } from "../lsp-monaco.js";

describe("lspLanguageForPath", () => {
  it("maps TypeScript/JavaScript and Python files", () => {
    expect(lspLanguageForPath("src/a.tsx")).toBe("typescript");
    expect(lspLanguageForPath("tools/b.mjs")).toBe("typescript");
    expect(lspLanguageForPath("tool.PY")).toBe("python");
  });

  it("leaves other files unmapped", () => {
    expect(lspLanguageForPath("README.md")).toBeNull();
    expect(lspLanguageForPath("Makefile")).toBeNull();
  });
});

describe("fileUriFor", () => {
  it("joins the workspace and relative path into a file URI", () => {
    expect(fileUriFor("/home/u/proj", "src/a.ts")).toBe("file:///home/u/proj/src/a.ts");
  });

  it("encodes spaces and URI-reserved characters in the path", () => {
    expect(fileUriFor("/home/u/my proj", "a#b?.ts")).toBe("file:///home/u/my%20proj/a%23b%3F.ts");
  });

  it("tolerates trailing and leading slashes", () => {
    expect(fileUriFor("/home/u/proj/", "/src/a.ts")).toBe("file:///home/u/proj/src/a.ts");
  });
});

/** Minimal Monaco double: records registrations so the test can invoke providers. */
function fakeMonaco() {
  const providers: Record<string, Record<string, (...args: any[]) => any>> = {};
  const register = (kind: string) => (lang: string, provider: Record<string, (...args: any[]) => any>) => {
    providers[`${kind}:${lang}`] = provider;
    return { dispose: vi.fn() };
  };
  const monaco = {
    Range: class {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
      constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number) {
        this.startLineNumber = startLineNumber;
        this.startColumn = startColumn;
        this.endLineNumber = endLineNumber;
        this.endColumn = endColumn;
      }
    },
    MarkerSeverity: { Hint: 1, Info: 2, Warning: 4, Error: 8 },
    languages: {
      CompletionItemKind: { Text: 0, Function: 1, Method: 2, Variable: 3 },
      registerHoverProvider: register("hover"),
      registerDefinitionProvider: register("definition"),
      registerCompletionItemProvider: register("completion"),
    },
    editor: { setModelMarkers: vi.fn() },
  };
  return { monaco: monaco as any, providers };
}

function fakeModel(uri: string) {
  return {
    uri: { toString: () => uri },
    getWordUntilPosition: () => ({ startColumn: 1, endColumn: 3 }),
  } as any;
}

describe("attachLspToModel", () => {
  it("sends didOpen with the buffer text and the file URI", () => {
    const { monaco } = fakeMonaco();
    const notify = vi.fn();
    const conn = { notify, request: vi.fn(), close: vi.fn() } as any;
    attachLspToModel(monaco, conn, { language: "typescript", model: fakeModel("inmemory://m/1"), fileUri: "file:///ws/a.ts", text: "x" });
    expect(notify).toHaveBeenCalledWith("textDocument/didOpen", {
      textDocument: { uri: "file:///ws/a.ts", languageId: "typescript", version: 1, text: "x" },
    });
  });

  it("answers hover only for its own model and converts positions to 0-based", async () => {
    const { monaco, providers } = fakeMonaco();
    const request = vi.fn().mockResolvedValue({ contents: { language: "ts", value: "const a: 1" } });
    const conn = { notify: vi.fn(), request, close: vi.fn() } as any;
    attachLspToModel(monaco, conn, { language: "typescript", model: fakeModel("inmemory://m/1"), fileUri: "file:///ws/a.ts", text: "" });
    const hover = providers["hover:typescript"].provideHover;

    expect(await hover(fakeModel("inmemory://other"), { lineNumber: 1, column: 1 })).toBeNull();
    expect(request).not.toHaveBeenCalled();

    const result = await hover(fakeModel("inmemory://m/1"), { lineNumber: 3, column: 5 });
    expect(request).toHaveBeenCalledWith("textDocument/hover", { textDocument: { uri: "file:///ws/a.ts" }, position: { line: 2, character: 4 } });
    expect(result.contents[0].value).toContain("const a: 1");
  });

  it("keeps only same-file definition targets", async () => {
    const { monaco, providers } = fakeMonaco();
    const request = vi.fn().mockResolvedValue([
      { uri: "file:///ws/a.ts", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } },
      { uri: "file:///ws/other.ts", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } },
    ]);
    const conn = { notify: vi.fn(), request, close: vi.fn() } as any;
    attachLspToModel(monaco, conn, { language: "typescript", model: fakeModel("inmemory://m/1"), fileUri: "file:///ws/a.ts", text: "" });
    const defs = await providers["definition:typescript"].provideDefinition(fakeModel("inmemory://m/1"), { lineNumber: 1, column: 1 });
    expect(defs).toHaveLength(1);
    expect(defs[0].range.startLineNumber).toBe(1);
  });

  it("disposes registrations and clears markers", () => {
    const { monaco } = fakeMonaco();
    const conn = { notify: vi.fn(), request: vi.fn(), close: vi.fn() } as any;
    const model = fakeModel("inmemory://m/1");
    const dispose = attachLspToModel(monaco, conn, { language: "python", model, fileUri: "file:///ws/t.py", text: "" });
    dispose();
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledWith(model, "lsp", []);
  });
});

describe("diagnosticsToMarkers", () => {
  it("maps LSP severity and 0-based ranges to Monaco markers", () => {
    const { monaco } = fakeMonaco();
    const markers = diagnosticsToMarkers(monaco, [
      { range: { start: { line: 1, character: 2 }, end: { line: 1, character: 6 } }, severity: 2, message: "unused" },
    ]);
    expect(markers).toEqual([
      { severity: 4, message: "unused", source: "lsp", startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 7 },
    ]);
  });
});
