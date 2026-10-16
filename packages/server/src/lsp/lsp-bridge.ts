/**
 * WebSocket bridge for language-server code intelligence (`/ws/lsp`).
 *
 * The upgrade is authenticated by the shared WS gate in `server.ts` (ticket +
 * tier), exactly like `/ws/terminal/*`. This module then enforces the
 * LSP-specific gates in order: the workspace must be a known session path, it
 * must be trusted, the language must be supported, and its server must be
 * installed. Each WebSocket owns one language-server process, which is stopped
 * when the socket closes or goes idle.
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { scheduleAtExpiry } from "../identity/socket-lifetime.js";
import { isLspLanguage, type LspCommand, type LspLanguage, resolveLspCommand } from "./lsp-languages.js";
import { LspSession } from "./lsp-session.js";
import { filterClientMessage, filterServerMessage } from "./lsp-policy.js";
import { normalizeWorkspaceRoot, type LspTrustStore } from "./lsp-trust.js";

/** Largest client frame accepted on the socket (LSP documents can be large). */
const MAX_CLIENT_PAYLOAD_BYTES = 8 * 1024 * 1024;

export interface LspBridgeDeps {
  /** True when `cwd` is a path the dashboard already knows as a session cwd. */
  isKnownSessionCwd(cwd: string): boolean;
  trust: LspTrustStore;
  idleTimeoutMs: number;
  /** Test seam; defaults to `resolveLspCommand`. */
  resolveCommand?: (language: LspLanguage) => LspCommand | null;
}

export interface LspBridge {
  readonly wss: WebSocketServer;
  /** Handle an already-authenticated `/ws/lsp` upgrade. */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer, principalExpiresAt?: number): void;
  close(): void;
}

function reject(socket: Duplex, status: string): void {
  socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
  socket.destroy();
}

export function createLspBridge(deps: LspBridgeDeps): LspBridge {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CLIENT_PAYLOAD_BYTES });
  const resolveCommand = deps.resolveCommand ?? ((language: LspLanguage) => resolveLspCommand(language));
  const live = new Set<WebSocket>();

  function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer, principalExpiresAt?: number): void {
    const url = new URL(request.url ?? "/", "http://localhost");
    const cwd = url.searchParams.get("cwd") ?? "";
    const language = url.searchParams.get("language") ?? "";
    if (!cwd || !isLspLanguage(language)) return reject(socket, "400 Bad Request");
    if (!deps.isKnownSessionCwd(cwd)) return reject(socket, "403 Forbidden");
    if (!deps.trust.isTrusted(cwd)) return reject(socket, "403 Forbidden");
    const command = resolveCommand(language);
    if (!command) return reject(socket, "503 Service Unavailable");

    const root = normalizeWorkspaceRoot(cwd);
    wss.handleUpgrade(request, socket, head, (ws) => {
      live.add(ws);
      const session: LspSession = new LspSession({
        root,
        command,
        idleTimeoutMs: deps.idleTimeoutMs,
        // Server → browser: forward diagnostics/responses; answer server requests in place.
        onMessage: (message) => {
          const verdict = filterServerMessage(message, root);
          if (verdict.kind === "forward") send(ws, verdict.message);
          else if (verdict.kind === "reply") session.send(verdict.message);
        },
        onClose: () => {
          if (ws.readyState === WebSocket.OPEN) ws.close(1001, "language server stopped");
        },
      });

      // Browser → server: allowlist + workspace containment; rejections go back to the browser.
      ws.on("message", (data) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data.toString());
        } catch {
          return;
        }
        const verdict = filterClientMessage(parsed, root);
        if (verdict.kind === "forward") session.send(verdict.message);
        else if (verdict.kind === "reply") send(ws, verdict.message);
      });

      const cancelExpiry = scheduleAtExpiry(principalExpiresAt, () => ws.close(1008, "identity expired"));
      ws.on("close", () => {
        cancelExpiry();
        live.delete(ws);
        session.close();
      });
    });
  }

  return {
    wss,
    handleUpgrade,
    close() {
      for (const ws of live) ws.close(1001, "server shutting down");
      live.clear();
      wss.close();
    },
  };
}

function send(ws: WebSocket, message: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}
