/**
 * Monaco's stock Python grammar dumps builtins (`len`, `str`, `self`) into
 * `keywords`, so the dashboard theme paints them the same purple as `def`.
 * Decorators are `tag`, the HTML color. Split those classes and mark `def` /
 * `class` names so the editor theme can color them apart.
 */
import { language as stockPython } from "monaco-editor/languages/definitions/python/python.js";

const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "case", "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "match",
  "nonlocal", "not", "or", "pass", "raise", "return", "try", "type", "while",
  "with", "yield",
]);

const PREDEFINED = new Set(["self", "cls"]);

interface WordRule {
  cases: Record<string, string>;
}
type RootRule = { include: string } | [RegExp, string | WordRule, string?];

export interface PythonLanguage {
  keywords: string[];
  builtins?: string[];
  predefined?: string[];
  tokenizer: { root: RootRule[]; [state: string]: unknown };
  [key: string]: unknown;
}

/** Copy of Monaco's Python monarch with keywords, builtins, and names split. */
export function refinePythonLanguage(language: PythonLanguage): PythonLanguage {
  const keywords: string[] = [];
  const builtins: string[] = [];
  const predefined: string[] = [];
  for (const word of language.keywords) {
    if (PYTHON_KEYWORDS.has(word)) keywords.push(word);
    else if (PREDEFINED.has(word)) predefined.push(word);
    else builtins.push(word);
  }
  if (!predefined.includes("cls")) predefined.push("cls");

  return {
    ...language,
    keywords,
    builtins,
    predefined,
    tokenizer: {
      ...language.tokenizer,
      root: [
        { include: "@whitespace" },
        { include: "@numbers" },
        { include: "@strings" },
        [/[,:;]/, "delimiter"],
        [/[{}\[\]()]/, "@brackets"],
        [/@[a-zA-Z_]\w*/, "decorator"],
        [/\bdef\b/, "keyword", "@afterDef"],
        [/\bclass\b/, "keyword", "@afterClass"],
        [/[a-zA-Z_]\w*/, {
          cases: {
            "@keywords": "keyword",
            "@builtins": "type.identifier",
            "@predefined": "variable.predefined",
            "@default": "identifier",
          },
        }],
      ],
      afterDef: [
        [/[ \t]+/, "white"],
        [/[a-zA-Z_]\w*/, "function", "@pop"],
        [/./, "@rematch", "@pop"],
      ],
      afterClass: [
        [/[ \t]+/, "white"],
        [/[a-zA-Z_]\w*/, "type.identifier", "@pop"],
        [/./, "@rematch", "@pop"],
      ],
    },
  };
}

let installed = false;

/** Replace the stock Python monarch once per page. */
export function installPythonHighlight(monaco: { languages: { setMonarchTokensProvider: (id: string, language: PythonLanguage) => void } }): void {
  if (installed) return;
  installed = true;
  monaco.languages.setMonarchTokensProvider("python", refinePythonLanguage(stockPython as PythonLanguage));
}
