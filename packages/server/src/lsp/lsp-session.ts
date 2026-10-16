/**
 * One language-server child process bound to one workspace root. Speaks the
 * LSP stdio framing; closes itself after `idleTimeoutMs` without traffic.
 *
 * The child gets a scrubbed environment: dashboard tokens and provider keys in
 * the server's own env must not reach workspace code run by a language server.
 */
import { type ChildProcess, spawn } from "@blackbelt-technology/pi-dashboard-shared/platform/exec.js";
import { encodeLspMessage, LspFrameParser } from "./lsp-framing.js";
import type { LspCommand } from "./lsp-languages.js";

/** Env vars a language server legitimately needs; everything else is dropped. */
const CHILD_ENV_KEYS = ["PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "USER"] as const;

export function lspChildEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of CHILD_ENV_KEYS) {
    const value = source[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

export interface LspSessionOptions {
  root: string;
  command: LspCommand;
  idleTimeoutMs: number;
  onMessage: (message: unknown) => void;
  onClose: (reason: "exit" | "idle" | "closed" | "error") => void;
}

export class LspSession {
  private readonly proc: ChildProcess;
  private readonly parser: LspFrameParser;
  private idleTimer: NodeJS.Timeout | undefined;
  private closed = false;
  private readonly opts: LspSessionOptions;

  constructor(opts: LspSessionOptions) {
    this.opts = opts;
    this.proc = spawn(opts.command.command, opts.command.args, {
      cwd: opts.root,
      env: lspChildEnv(),
      stdio: ["pipe", "pipe", "ignore"],
    });
    this.parser = new LspFrameParser(
      (message) => {
        this.touch();
        opts.onMessage(message);
      },
      () => this.finish("error"),
    );
    this.proc.stdout?.on("data", (chunk: Buffer) => this.parser.push(chunk));
    this.proc.stdin?.on("error", () => this.finish("error"));
    this.proc.once("exit", () => this.finish("exit"));
    this.proc.once("error", () => this.finish("error"));
    this.touch();
  }

  /** Write one JSON-RPC message to the server. False once the session is closed. */
  send(message: unknown): boolean {
    if (this.closed || !this.proc.stdin) return false;
    this.touch();
    this.proc.stdin.write(encodeLspMessage(message));
    return true;
  }

  /** Ask the server to exit, then kill it. Idempotent. */
  close(): void {
    if (this.closed) return;
    try {
      this.proc.stdin?.write(encodeLspMessage({ jsonrpc: "2.0", method: "exit" }));
    } catch {
      /* stdin already gone — kill below */
    }
    this.finish("closed");
  }

  get isClosed(): boolean {
    return this.closed;
  }

  private touch(): void {
    if (this.closed) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.finish("idle"), this.opts.idleTimeoutMs);
    this.idleTimer.unref?.();
  }

  private finish(reason: "exit" | "idle" | "closed" | "error"): void {
    if (this.closed) return;
    this.closed = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.proc.exitCode === null && this.proc.signalCode === null) this.proc.kill("SIGTERM");
    this.opts.onClose(reason);
  }
}
