import { describe, expect, it } from "vitest";
import { refinePythonLanguage, type PythonLanguage } from "../python-highlight.js";

function sample(): PythonLanguage {
  return {
    keywords: ["def", "class", "if", "return", "self", "len", "str", "print", "type"],
    tokenizer: { root: [], whitespace: [] },
  };
}

describe("refinePythonLanguage", () => {
  it("keeps real keywords purple-class and moves builtins and self off that list", () => {
    const out = refinePythonLanguage(sample());
    expect(out.keywords).toEqual(["def", "class", "if", "return", "type"]);
    expect(out.builtins).toEqual(["len", "str", "print"]);
    expect(out.predefined).toEqual(["self", "cls"]);
  });

  it("does not mutate the stock grammar", () => {
    const input = sample();
    refinePythonLanguage(input);
    expect(input.keywords).toContain("self");
    expect(input.builtins).toBeUndefined();
  });

  it("marks decorators and declaration names as their own tokens", () => {
    const root = refinePythonLanguage(sample()).tokenizer.root;
    expect(root).toContainEqual([/@[a-zA-Z_]\w*/, "decorator"]);
    expect(root).toContainEqual([/\bdef\b/, "keyword", "@afterDef"]);
    expect(root).toContainEqual([/\bclass\b/, "keyword", "@afterClass"]);
    const words = root.find((rule) => Array.isArray(rule) && rule[0].source === "[a-zA-Z_]\\w*");
    expect(words?.[1]).toMatchObject({
      cases: {
        "@keywords": "keyword",
        "@builtins": "type.identifier",
        "@predefined": "variable.predefined",
      },
    });
  });
});
