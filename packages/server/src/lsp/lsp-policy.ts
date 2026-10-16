/**
 * Message policy for the LSP bridge. Pure functions, so the allowlist and the
 * workspace-root checks are unit-testable without a socket or a process.
 *
 * Client → server: only an allowlisted set of methods reaches the server, and
 * every document URI must lie inside the trusted root. `initialize` is rewritten
 * so the server's root is always the trusted workspace, never a client-chosen
 * path.
 *
 * Server → client: only diagnostics and responses are forwarded. Server-initiated
 * requests (e.g. `workspace/configuration`) are answered by the bridge with an
 * empty result, so the server never waits on the browser for them.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isFileUriInsideRoot } from "./lsp-path-guard.js";

const CLIENT_METHODS: ReadonlySet<string> = new Set([
  "initialize",
  "initialized",
  "shutdown",
  "exit",
  "$/cancelRequest",
  "textDocument/didOpen",
  "textDocument/didChange",
  "textDocument/didClose",
  "textDocument/hover",
  "textDocument/definition",
  "textDocument/completion",
]);

/** Methods whose params carry a `textDocument.uri` that must be inside the root. */
const DOCUMENT_METHODS: ReadonlySet<string> = new Set([
  "textDocument/didOpen",
  "textDocument/didChange",
  "textDocument/didClose",
  "textDocument/hover",
  "textDocument/definition",
  "textDocument/completion",
]);

type Json = Record<string, unknown>;

export type PolicyVerdict =
  | { kind: "forward"; message: Json }
  | { kind: "reply"; message: Json }
  | { kind: "drop" };

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function errorReply(id: unknown, code: number, message: string): Json {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** Rewrite `initialize` so the server sees exactly the trusted root and nothing else. */
function pinInitializeRoot(params: Json, root: string): Json {
  const rootUri = pathToFileURL(root).href;
  return {
    ...params,
    processId: null,
    rootPath: root,
    rootUri,
    workspaceFolders: [{ uri: rootUri, name: path.basename(root) || "workspace" }],
  };
}

/** Answer for a server-initiated request the bridge handles locally. */
function localServerRequestResult(method: string, params: Json | null): unknown {
  if (method === "workspace/configuration") {
    const items = Array.isArray(params?.items) ? params.items : [];
    return items.map(() => null);
  }
  return null;
}

const LOCAL_SERVER_REQUESTS: ReadonlySet<string> = new Set([
  "workspace/configuration",
  "client/registerCapability",
  "client/unregisterCapability",
  "window/workDoneProgress/create",
  "window/showMessageRequest",
]);

export function filterClientMessage(raw: unknown, root: string): PolicyVerdict {
  const msg = asObject(raw);
  if (!msg || typeof msg.method !== "string") return { kind: "drop" };
  const id = msg.id;
  const hasId = id !== undefined;
  if (!CLIENT_METHODS.has(msg.method)) {
    return hasId ? { kind: "reply", message: errorReply(id, -32601, `method not allowed: ${msg.method}`) } : { kind: "drop" };
  }
  if (DOCUMENT_METHODS.has(msg.method)) {
    const params = asObject(msg.params);
    const doc = asObject(params?.textDocument);
    if (!isFileUriInsideRoot(doc?.uri, root)) {
      return hasId ? { kind: "reply", message: errorReply(id, -32602, "document outside workspace") } : { kind: "drop" };
    }
  }
  if (msg.method === "initialize") {
    const params = asObject(msg.params) ?? {};
    return { kind: "forward", message: { ...msg, params: pinInitializeRoot(params, root) } };
  }
  return { kind: "forward", message: msg };
}

export function filterServerMessage(raw: unknown, root: string): PolicyVerdict {
  const msg = asObject(raw);
  if (!msg) return { kind: "drop" };
  if (typeof msg.method === "string") {
    if (msg.id !== undefined) {
      // Server-initiated request: answer locally, never forward.
      if (LOCAL_SERVER_REQUESTS.has(msg.method)) {
        const result = localServerRequestResult(msg.method, asObject(msg.params));
        return { kind: "reply", message: { jsonrpc: "2.0", id: msg.id, result } };
      }
      return { kind: "reply", message: errorReply(msg.id, -32601, `client method not supported: ${msg.method}`) };
    }
    if (msg.method === "textDocument/publishDiagnostics") {
      const params = asObject(msg.params);
      return isFileUriInsideRoot(params?.uri, root) ? { kind: "forward", message: msg } : { kind: "drop" };
    }
    return { kind: "drop" };
  }
  // A response to a client request.
  return msg.id !== undefined ? { kind: "forward", message: msg } : { kind: "drop" };
}
