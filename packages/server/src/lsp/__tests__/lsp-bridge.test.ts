import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLspBridge, type LspBridge } from "../lsp-bridge.js";
import { createLspTrustStore } from "../lsp-trust.js";

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "fake-lsp-server.mjs");

interface Harness {
  url: (query: string) => string;
  bridge: LspBridge;
  trust: ReturnType<typeof createLspTrustStore>;
  close: () => Promise<void>;
}

describe("LSP WebSocket bridge", () => {
  let dir: string;
  let root: string;
  let harness: Harness | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lsp-bridge-"));
    root = path.join(dir, "ws");
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, "a.ts"), "export const a = 1;\n");
    fs.writeFileSync(path.join(dir, "secret.ts"), "export const s = 2;\n");
  });

  afterEach(async () => {
    await harness?.close();
    harness = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function start(opts: { trusted: boolean; resolveCommand?: boolean }): Promise<Harness> {
    const trust = createLspTrustStore(path.join(dir, "lsp-trust.json"));
    if (opts.trusted) trust.setTrusted(root, true);
    const bridge = createLspBridge({
      isKnownSessionCwd: (cwd) => cwd === root,
      trust,
      idleTimeoutMs: 60_000,
      resolveCommand: (language) => (opts.resolveCommand === false || language !== "typescript" ? null : { command: process.execPath, args: [FAKE] }),
    });
    const server = http.createServer((_req, res) => res.end());
    server.on("upgrade", (req, socket, head) => bridge.handleUpgrade(req, socket, head));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    harness = {
      bridge,
      trust,
      url: (query) => `ws://127.0.0.1:${port}/ws/lsp?${query}`,
      close: () => new Promise<void>((resolve) => {
        bridge.close();
        server.close(() => resolve());
      }),
    };
    return harness;
  }

  function connect(url: string): Promise<{ ws: WebSocket; messages: any[] }> {
    const ws = new WebSocket(url);
    const messages: any[] = [];
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    return new Promise((resolve, reject) => {
      ws.once("open", () => resolve({ ws, messages }));
      ws.once("error", reject);
    });
  }

  function waitFor<T>(predicate: () => T | undefined, timeoutMs = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const v = predicate();
        if (v !== undefined) return resolve(v);
        if (Date.now() - started > timeoutMs) return reject(new Error("waitFor timed out"));
        setTimeout(tick, 10);
      };
      tick();
    });
  }

  it("refuses an untrusted workspace with 403", async () => {
    const h = await start({ trusted: false });
    await expect(connect(h.url(`cwd=${encodeURIComponent(root)}&language=typescript`))).rejects.toThrow(/403/);
  });

  it("refuses an unsupported language with 400", async () => {
    const h = await start({ trusted: true });
    await expect(connect(h.url(`cwd=${encodeURIComponent(root)}&language=rust`))).rejects.toThrow(/400/);
  });

  it("refuses when the language server is not installed with 503", async () => {
    const h = await start({ trusted: true, resolveCommand: false });
    await expect(connect(h.url(`cwd=${encodeURIComponent(root)}&language=typescript`))).rejects.toThrow(/503/);
  });

  it("round-trips a trusted hover request and pins initialize to the root", async () => {
    const h = await start({ trusted: true });
    const { ws, messages } = await connect(h.url(`cwd=${encodeURIComponent(root)}&language=typescript`));
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: "file:///etc" } }));
    await waitFor(() => messages.find((m) => m.id === 1));

    const uri = pathToFileURL(path.join(root, "a.ts")).href;
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "textDocument/hover", params: { textDocument: { uri }, position: { line: 0, character: 0 } } }));
    const hover = await waitFor(() => messages.find((m) => m.id === 2));
    expect(hover.result.method).toBe("textDocument/hover");
    ws.close();
  });

  it("rejects a document outside the workspace without reaching the server", async () => {
    const h = await start({ trusted: true });
    const { ws, messages } = await connect(h.url(`cwd=${encodeURIComponent(root)}&language=typescript`));
    const outside = pathToFileURL(path.join(dir, "secret.ts")).href;
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "textDocument/definition", params: { textDocument: { uri: outside }, position: { line: 0, character: 0 } } }));
    const reply = await waitFor(() => messages.find((m) => m.id === 3));
    expect(reply.error.code).toBe(-32602);
    ws.close();
  });

  it("answers a server-initiated configuration request itself and never forwards it", async () => {
    const h = await start({ trusted: true });
    const { ws, messages } = await connect(h.url(`cwd=${encodeURIComponent(root)}&language=typescript`));
    ws.send(JSON.stringify({ jsonrpc: "2.0", method: "trigger/askConfig" }));
    await new Promise((r) => setTimeout(r, 300));
    expect(messages.some((m) => m.method === "workspace/configuration")).toBe(false);
    ws.close();
  });

  it("closes cleanly when the client disconnects", async () => {
    const h = await start({ trusted: true });
    const { ws } = await connect(h.url(`cwd=${encodeURIComponent(root)}&language=typescript`));
    ws.close();
    await new Promise((r) => setTimeout(r, 200));
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
