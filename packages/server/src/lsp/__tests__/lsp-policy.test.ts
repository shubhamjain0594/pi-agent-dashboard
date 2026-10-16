import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filterClientMessage, filterServerMessage } from "../lsp-policy.js";

describe("LSP client→server policy", () => {
  let dir: string;
  let root: string;
  let inside: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lsp-policy-"));
    root = path.join(dir, "ws");
    fs.mkdirSync(root);
    inside = path.join(root, "a.ts");
    fs.writeFileSync(inside, "");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const doc = (file: string) => ({ textDocument: { uri: pathToFileURL(file).href } });

  it("forwards an allowlisted document request inside the root", () => {
    const v = filterClientMessage({ jsonrpc: "2.0", id: 1, method: "textDocument/hover", params: { ...doc(inside), position: { line: 0, character: 0 } } }, root);
    expect(v.kind).toBe("forward");
  });

  it("rejects a non-allowlisted method with a JSON-RPC error when it has an id", () => {
    const v = filterClientMessage({ jsonrpc: "2.0", id: 7, method: "workspace/executeCommand", params: {} }, root);
    expect(v).toMatchObject({ kind: "reply", message: { id: 7, error: { code: -32601 } } });
  });

  it("drops a non-allowlisted notification silently", () => {
    expect(filterClientMessage({ jsonrpc: "2.0", method: "workspace/didChangeConfiguration", params: {} }, root)).toEqual({ kind: "drop" });
  });

  it("rejects a document outside the workspace", () => {
    const outside = path.join(dir, "secret.ts");
    fs.writeFileSync(outside, "");
    const v = filterClientMessage({ jsonrpc: "2.0", id: 2, method: "textDocument/definition", params: doc(outside) }, root);
    expect(v).toMatchObject({ kind: "reply", message: { id: 2, error: { code: -32602 } } });
  });

  it("drops an out-of-workspace didOpen notification silently", () => {
    const outside = path.join(dir, "secret.ts");
    fs.writeFileSync(outside, "");
    expect(filterClientMessage({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: pathToFileURL(outside).href } } }, root)).toEqual({ kind: "drop" });
  });

  it("pins initialize to the trusted root, ignoring any client-supplied root", () => {
    const v = filterClientMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: "file:///etc", workspaceFolders: [{ uri: "file:///etc", name: "etc" }] } },
      root,
    );
    expect(v.kind).toBe("forward");
    if (v.kind !== "forward") return;
    const params = v.message.params as { rootUri: string; rootPath: string; workspaceFolders: { uri: string }[] };
    expect(params.rootPath).toBe(root);
    expect(params.rootUri).toBe(pathToFileURL(root).href);
    expect(params.workspaceFolders.map((f) => f.uri)).toEqual([pathToFileURL(root).href]);
  });

  it("drops non-object frames", () => {
    expect(filterClientMessage([1, 2], root)).toEqual({ kind: "drop" });
    expect(filterClientMessage("hello", root)).toEqual({ kind: "drop" });
  });
});

describe("LSP server→client policy", () => {
  const root = "/tmp/ws";

  it("forwards diagnostics for a file inside the root", () => {
    const msg = { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri: pathToFileURL("/tmp/ws/a.ts").href, diagnostics: [] } };
    expect(filterServerMessage(msg, root)).toEqual({ kind: "forward", message: msg });
  });

  it("drops diagnostics for a file outside the root", () => {
    const msg = { jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri: "file:///etc/passwd", diagnostics: [] } };
    expect(filterServerMessage(msg, root)).toEqual({ kind: "drop" });
  });

  it("drops log and show notifications", () => {
    expect(filterServerMessage({ jsonrpc: "2.0", method: "window/logMessage", params: {} }, root)).toEqual({ kind: "drop" });
  });

  it("answers workspace/configuration locally with one null per item", () => {
    const v = filterServerMessage({ jsonrpc: "2.0", id: 900, method: "workspace/configuration", params: { items: [{}, {}] } }, root);
    expect(v).toEqual({ kind: "reply", message: { jsonrpc: "2.0", id: 900, result: [null, null] } });
  });

  it("refuses an unknown server request with a JSON-RPC error", () => {
    const v = filterServerMessage({ jsonrpc: "2.0", id: 3, method: "workspace/applyEdit", params: {} }, root);
    expect(v).toMatchObject({ kind: "reply", message: { id: 3, error: { code: -32601 } } });
  });

  it("forwards responses to client requests", () => {
    const msg = { jsonrpc: "2.0", id: 5, result: null };
    expect(filterServerMessage(msg, root)).toEqual({ kind: "forward", message: msg });
  });
});
