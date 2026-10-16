import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { lspChildEnv, LspSession } from "../lsp-session.js";

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "fake-lsp-server.mjs");
const fakeCommand = { command: process.execPath, args: [FAKE] };

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

describe("LspSession", () => {
  const sessions: LspSession[] = [];
  afterEach(() => {
    for (const s of sessions.splice(0)) s.close();
  });

  function open(opts: { idleTimeoutMs?: number; onClose?: (r: string) => void } = {}) {
    const received: any[] = [];
    let closed: string | undefined;
    const session = new LspSession({
      root: process.cwd(),
      command: fakeCommand,
      idleTimeoutMs: opts.idleTimeoutMs ?? 60_000,
      onMessage: (m) => received.push(m),
      onClose: (r) => {
        closed = r;
        opts.onClose?.(r);
      },
    });
    sessions.push(session);
    return { session, received, closedReason: () => closed };
  }

  it("answers a request round-trip through the child process", async () => {
    const { session, received } = open();
    session.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const reply = await waitFor(() => received.find((m) => m.id === 1));
    expect(reply.result.capabilities.hoverProvider).toBe(true);
  });

  it("forwards a server-initiated request so the bridge can answer it", async () => {
    const { session, received } = open();
    session.send({ jsonrpc: "2.0", method: "trigger/askConfig" });
    const req = await waitFor(() => received.find((m) => m.method === "workspace/configuration"));
    expect(req.id).toBe(900);
  });

  it("closes itself after the idle timeout", async () => {
    const { session, closedReason } = open({ idleTimeoutMs: 150 });
    await waitFor(() => (session.isClosed ? true : undefined));
    expect(closedReason()).toBe("idle");
  });

  it("refuses sends after close", () => {
    const { session } = open();
    session.close();
    expect(session.send({ jsonrpc: "2.0", id: 2, method: "initialize" })).toBe(false);
  });

  it("drops environment variables that are not on the allowlist", () => {
    const env = lspChildEnv({ PATH: "/usr/bin", HOME: "/h", PI_DASHBOARD_TOKEN: "secret", OPENAI_API_KEY: "sk-x" });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/h" });
  });
});
