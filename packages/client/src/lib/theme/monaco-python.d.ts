// Monaco ships this monarch as plain JS. Only `register.d.ts` sits beside it,
// so the import is an untyped module unless this ambient declaration exists.
declare module "monaco-editor/languages/definitions/python/python.js" {
  const language: {
    keywords: string[];
    tokenizer: { root: unknown[]; [state: string]: unknown };
    [key: string]: unknown;
  };

  export { language };
}
