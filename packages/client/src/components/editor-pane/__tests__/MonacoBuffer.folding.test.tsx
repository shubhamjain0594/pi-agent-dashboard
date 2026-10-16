/**
 * Regression: the read-only code viewer folds the file's leading block comment
 * and import ranges by default.
 *
 * MonacoBuffer enables folding with `foldingImportsByDefault`, and once the
 * file content arrives it runs the public `editor.foldAllBlockComments` action.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import React from "react";
import { ThemeProvider } from "../../settings/ThemeProvider.js";

const { runFold, getAction } = vi.hoisted(() => {
  const runFold = vi.fn();
  return { runFold, getAction: vi.fn(() => ({ run: runFold })) };
});

let editorProps: { options?: Record<string, unknown> } = {};

const fakeMonaco = {
  languages: {
    typescript: {
      typescriptDefaults: { setDiagnosticsOptions: vi.fn() },
      javascriptDefaults: { setDiagnosticsOptions: vi.fn() },
    },
    setMonarchTokensProvider: vi.fn(),
  },
  editor: { defineTheme: vi.fn(), setTheme: vi.fn() },
};

// Mock @monaco-editor/react: capture props and mount with a fake editor.
vi.mock("@monaco-editor/react", () => ({
  __esModule: true,
  default: (props: {
    options?: Record<string, unknown>;
    beforeMount?: (m: unknown) => void;
    onMount?: (editor: unknown, m: unknown) => void;
  }) => {
    editorProps = props;
    React.useEffect(() => {
      props.beforeMount?.(fakeMonaco);
      props.onMount?.(
        { getAction, getModel: () => null, revealLineInCenter: vi.fn(), setPosition: vi.fn() },
        fakeMonaco,
      );
    }, []);
    return <div data-testid="monaco" />;
  },
}));

vi.mock("../monaco-setup.js", () => ({ ensureMonacoLoader: () => {} }));
vi.mock("../../../lib/theme/monaco-theme.js", () => ({
  buildMonacoTheme: (themeName: string, resolved: string) => ({
    name: `pi-monaco-${themeName}-${resolved}`,
    data: { base: "vs-dark", inherit: true, rules: [], colors: {} },
  }),
}));
vi.mock("../../../lib/api/api-context.js", () => ({ getApiBase: () => "" }));

import MonacoBuffer from "../MonacoBuffer.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  runFold.mockClear();
  getAction.mockClear();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia;
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          success: true,
          data: { type: "file", content: "/** header */\nimport a from \"a\";\n" },
        }),
    }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("MonacoBuffer folding by default", () => {
  it("enables folding and collapses import ranges on open", async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <MonacoBuffer cwd="/x" path="/x/a.tsx" kind="text" mimeType="text/plain" size={0} />
        </ThemeProvider>,
      );
    });
    expect(editorProps.options).toMatchObject({
      folding: true,
      foldingImportsByDefault: true,
    });
  });

  it("folds the leading block comment once file content loads", async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <MonacoBuffer cwd="/x" path="/x/a.tsx" kind="text" mimeType="text/plain" size={0} />
        </ThemeProvider>,
      );
    });
    await waitFor(() => expect(runFold).toHaveBeenCalledTimes(1));
    expect(getAction).toHaveBeenCalledWith("editor.foldAllBlockComments");
  });
});

describe("MonacoBuffer word wrap", () => {
  it("wraps long lines instead of scrolling horizontally", async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <MonacoBuffer cwd="/x" path="/x/a.tsx" kind="text" mimeType="text/plain" size={0} />
        </ThemeProvider>,
      );
    });
    expect(editorProps.options).toMatchObject({ wordWrap: "on" });
  });
});
