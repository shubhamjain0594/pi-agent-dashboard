/**
 * Browser end of the language-server bridge (`/ws/lsp`): a JSON-RPC client over
 * one WebSocket per (workspace, language). The server pins the workspace root
 * and enforces the method allowlist; this side only tracks request ids,
 * timeouts, and the `initialize` handshake.
 */
import { appendWsTicket, mintWsTicket } from "../pairing/device-auth.js";
import type { LspClientLanguage } from "../api/lsp-api.js";

const REQUEST_TIMEOUT_MS = 10_000;
const INITIALIZE_TIMEOUT_MS = 30_000;

const EXT_LANGUAGE: Record<string, LspClientLanguage> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "typescript", jsx: "typescript", mjs: "typescript", cjs: "typescript",
  py: "python",
};

/** Mirrors the server's `lspLanguageForPath`; both must agree on supported extensions. */
export function lspLanguageForPath(path: string): LspClientLanguage | null {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return EXT_LANGUAGE[ext] ?? null;
}

export interface LspDiagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  severity?: number;
  message: string;
  source?: string;
}

export interface LspConnectionOptions {
  cwd: string;
  language: LspClientLanguage;
  onDiagnostics?: (uri: string, diagnostics: LspDiagnostic[]) => void;
}

export class LspConnection {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private closed = false;
  private readonly ws: WebSocket;

  private constructor(ws: WebSocket) {
    this.ws = ws;
  }

  /** Open the socket and complete the `initialize` handshake. Null when the server refuses. */
  static async open(opts: LspConnectionOptions): Promise<LspConnection | null> {
    const ticket = await mintWsTicket("lsp");
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsPort = window.location.port ? `:${window.location.port}` : "";
    let url = `${wsProtocol}//${window.location.hostname}${wsPort}/ws/lsp?cwd=${encodeURIComponent(opts.cwd)}&language=${opts.language}`;
    if (ticket) url = appendWsTicket(url, ticket);

    const ws = new WebSocket(url);
    const connection = new LspConnection(ws);
    ws.addEventListener("message", (event) => connection.handleMessage(event.data, opts.onDiagnostics));
    ws.addEventListener("close", () => connection.failAll(new Error("language server connection closed")));

    const opened = await new Promise<boolean>((resolve) => {
      ws.addEventListener("open", () => resolve(true), { once: true });
      ws.addEventListener("error", () => resolve(false), { once: true });
      ws.addEventListener("close", () => resolve(false), { once: true });
    });
    if (!opened) return null;

    try {
      await connection.request(
        "initialize",
        { processId: null, rootUri: null, capabilities: {} },
        INITIALIZE_TIMEOUT_MS,
      );
      connection.notify("initialized", {});
      return connection;
    } catch {
      connection.close();
      return null;
    }
  }

  request(method: string, params: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<any> {
    if (this.closed) return Promise.reject(new Error("language server connection closed"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`language server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  notify(method: string, params: unknown): void {
    if (this.closed) return;
    this.ws.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
  }

  /** Closing the socket makes the server send `exit` and stop its process. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.ws.close(1000, "viewer closed");
    this.failAll(new Error("language server connection closed"));
  }

  private handleMessage(data: unknown, onDiagnostics?: LspConnectionOptions["onDiagnostics"]): void {
    if (typeof data !== "string") return;
    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(msg.error.message ?? "language server error"));
      else entry.resolve(msg.result);
      return;
    }
    if (msg.method === "textDocument/publishDiagnostics" && onDiagnostics) {
      onDiagnostics(msg.params?.uri ?? "", Array.isArray(msg.params?.diagnostics) ? msg.params.diagnostics : []);
    }
  }

  private failAll(error: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }
}
