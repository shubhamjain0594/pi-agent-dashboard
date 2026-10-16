/**
 * `.html` editor tab: Source (read-only Monaco) by default, with a Preview
 * toggle that mounts the sandboxed `HtmlPreview`. A canvas auto-open
 * (`restrictCsp`) defaults to Preview instead.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/api/api-context.js", () => ({ getApiBase: () => "" }));
vi.mock("../MonacoBuffer.js", () => ({
  default: (p: { path: string }) => <div data-testid="monaco-viewer">{p.path}</div>,
}));

import { HtmlTab } from "../HtmlTab.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve("<h1>hi</h1>"),
    }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const props = { cwd: "/proj", path: "index.html", kind: "html", mimeType: "text/html", size: 0 } as const;

describe("HtmlTab", () => {
  it("defaults to the Source view (Monaco), not the rendered page", async () => {
    const { findByTestId, container } = render(<HtmlTab {...props} />);
    expect(await findByTestId("monaco-viewer")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[data-testid="html-source-toggle"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("Preview toggle mounts a sandboxed iframe with scripts disabled", async () => {
    const { findByTestId, container, queryByTestId } = render(<HtmlTab {...props} />);
    await findByTestId("monaco-viewer");
    fireEvent.click(container.querySelector('[data-testid="html-preview-toggle"]')!);
    await waitFor(() => expect(container.querySelector("iframe")).toBeTruthy());
    const sandbox = container.querySelector("iframe")!.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).not.toContain("allow-scripts");
    expect(queryByTestId("monaco-viewer")).toBeNull();
  });

  it("Source toggle returns to Monaco after Preview", async () => {
    const { findByTestId, container, queryByTestId } = render(<HtmlTab {...props} />);
    await findByTestId("monaco-viewer");
    fireEvent.click(container.querySelector('[data-testid="html-preview-toggle"]')!);
    await waitFor(() => expect(container.querySelector("iframe")).toBeTruthy());
    fireEvent.click(container.querySelector('[data-testid="html-source-toggle"]')!);
    expect(await findByTestId("monaco-viewer")).toBeTruthy();
    expect(queryByTestId("monaco-viewer")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("a canvas auto-open (restrictCsp) defaults to the rendered Preview", async () => {
    const { container, queryByTestId } = render(<HtmlTab {...props} restrictCsp />);
    await waitFor(() => expect(container.querySelector("iframe")).toBeTruthy());
    expect(queryByTestId("monaco-viewer")).toBeNull();
  });
});
