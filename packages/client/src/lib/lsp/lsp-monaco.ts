/**
 * Adapts a live `LspConnection` to one Monaco model: hover, definition,
 * completion, and diagnostics markers. Monaco language providers are global to
 * the page, so every provider checks that the request comes from THIS model
 * before asking the server; other editors on the page stay untouched.
 */
import type * as monacoNs from "monaco-editor";
import type { LspClientLanguage } from "../api/lsp-api.js";
import type { LspConnection, LspDiagnostic } from "./lsp-connection.js";

type Monaco = typeof monacoNs;

const MONACO_LANGUAGE_IDS: Record<LspClientLanguage, string[]> = {
  typescript: ["typescript", "javascript"],
  python: ["python"],
};

/** LSP CompletionItemKind (1-based) → Monaco CompletionItemKind member name. */
const LSP_COMPLETION_KIND: Record<number, string> = {
  1: "Text", 2: "Method", 3: "Function", 4: "Constructor", 5: "Field", 6: "Variable",
  7: "Class", 8: "Interface", 9: "Module", 10: "Property", 11: "Unit", 12: "Value",
  13: "Enum", 14: "Keyword", 15: "Snippet", 16: "Color", 17: "File", 18: "Reference",
  19: "Folder", 20: "EnumMember", 21: "Constant", 22: "Struct", 23: "Event", 24: "Operator", 25: "TypeParameter",
};

const LSP_SEVERITY_TO_MARKER: Record<number, keyof typeof monacoNs.MarkerSeverity> = {
  1: "Error", 2: "Warning", 3: "Info", 4: "Hint",
};

interface LspPosition { line: number; character: number }
interface LspRange { start: LspPosition; end: LspPosition }

function toMonacoRange(monaco: Monaco, range: LspRange): monacoNs.Range {
  return new monaco.Range(range.start.line + 1, range.start.character + 1, range.end.line + 1, range.end.character + 1);
}

/** Convert LSP diagnostics to Monaco markers for a `setModelMarkers` call. */
export function diagnosticsToMarkers(monaco: Monaco, diagnostics: LspDiagnostic[]): monacoNs.editor.IMarkerData[] {
  return diagnostics.map((d) => {
    const key = LSP_SEVERITY_TO_MARKER[d.severity ?? 1] ?? "Error";
    const range = toMonacoRange(monaco, d.range);
    return {
      severity: monaco.MarkerSeverity[key],
      message: d.message,
      source: d.source ?? "lsp",
      startLineNumber: range.startLineNumber,
      startColumn: range.startColumn,
      endLineNumber: range.endLineNumber,
      endColumn: range.endColumn,
    };
  });
}

function hoverText(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const v = item as { language?: string; value?: string };
    if (v.language) return "```" + v.language + "\n" + (v.value ?? "") + "\n```";
    return v.value ?? "";
  }
  return "";
}

/**
 * Register providers for `model` and send `didOpen` with the buffer text.
 * Returns a disposer that unregisters providers and clears this model's markers.
 */
export function attachLspToModel(
  monaco: Monaco,
  conn: LspConnection,
  opts: { language: LspClientLanguage; model: monacoNs.editor.ITextModel; fileUri: string; text: string },
): () => void {
  const { model, fileUri } = opts;
  const modelUri = model.uri.toString();
  const isOurs = (m: monacoNs.editor.ITextModel) => m.uri.toString() === modelUri;
  const at = (p: monacoNs.Position): LspPosition => ({ line: p.lineNumber - 1, character: p.column - 1 });
  const disposables: monacoNs.IDisposable[] = [];

  conn.notify("textDocument/didOpen", {
    textDocument: { uri: fileUri, languageId: opts.language, version: 1, text: opts.text },
  });

  for (const id of MONACO_LANGUAGE_IDS[opts.language]) {
    disposables.push(
      monaco.languages.registerHoverProvider(id, {
        provideHover: async (m, position) => {
          if (!isOurs(m)) return null;
          const r = await conn.request("textDocument/hover", { textDocument: { uri: fileUri }, position: at(position) }).catch(() => null);
          if (!r) return null;
          const contents = (Array.isArray(r.contents) ? r.contents : [r.contents]).map((c: unknown) => ({ value: hoverText(c) }));
          return { contents, range: r.range ? toMonacoRange(monaco, r.range) : undefined };
        },
      }),
      monaco.languages.registerDefinitionProvider(id, {
        provideDefinition: async (m, position) => {
          if (!isOurs(m)) return null;
          const r = await conn.request("textDocument/definition", { textDocument: { uri: fileUri }, position: at(position) }).catch(() => null);
          if (!r) return null;
          const locations = (Array.isArray(r) ? r : [r]) as { uri?: string; range?: LspRange; targetUri?: string; targetRange?: LspRange }[];
          // Same-file targets use this model. Other workspace files are real
          // file URIs; the editor opener turns those into a new tab.
          return locations
            .map((l) => ({ uri: l.uri ?? l.targetUri, range: l.range ?? l.targetRange }))
            .filter((l): l is { uri: string; range: LspRange } => Boolean(l.uri && l.range))
            .map((l) => ({
              uri: l.uri === fileUri ? m.uri : monaco.Uri.parse(l.uri),
              range: toMonacoRange(monaco, l.range),
            }));
        },
      }),
      monaco.languages.registerCompletionItemProvider(id, {
        provideCompletionItems: async (m, position) => {
          if (!isOurs(m)) return null;
          const r = await conn.request("textDocument/completion", { textDocument: { uri: fileUri }, position: at(position) }).catch(() => null);
          if (!r) return null;
          const items: any[] = Array.isArray(r) ? r : Array.isArray(r.items) ? r.items : [];
          const word = m.getWordUntilPosition(position);
          const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
          return {
            incomplete: false,
            suggestions: items.map((it) => ({
              label: it.label,
              kind: monaco.languages.CompletionItemKind[LSP_COMPLETION_KIND[it.kind ?? 1] as keyof typeof monacoNs.languages.CompletionItemKind] ?? monaco.languages.CompletionItemKind.Text,
              insertText: it.insertText ?? it.label,
              detail: it.detail,
              range,
            })),
          };
        },
      }),
    );
  }

  return () => {
    for (const d of disposables) d.dispose();
    monaco.editor.setModelMarkers(model, "lsp", []);
  };
}
