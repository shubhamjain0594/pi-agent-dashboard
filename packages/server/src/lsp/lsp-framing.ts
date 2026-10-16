/**
 * LSP base-protocol framing for the stdio transport: `Content-Length` header,
 * blank line, then a UTF-8 JSON body. Bounded so a misbehaving language server
 * cannot grow the parse buffer without limit.
 */

const MAX_HEADER_BYTES = 8 * 1024;
export const MAX_LSP_BODY_BYTES = 16 * 1024 * 1024;

/** Serialize one JSON-RPC message with its `Content-Length` header. */
export function encodeLspMessage(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

/** Incremental parser: feed raw stdout chunks, receive complete JSON messages. */
export class LspFrameParser {
  private buf: Buffer = Buffer.alloc(0);
  private failed = false;
  private readonly onMessage: (message: unknown) => void;
  private readonly onError: (error: Error) => void;

  constructor(onMessage: (message: unknown) => void, onError: (error: Error) => void) {
    this.onMessage = onMessage;
    this.onError = onError;
  }

  push(chunk: Buffer): void {
    if (this.failed) return;
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]);
    for (;;) {
      const headerEnd = this.buf.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        if (this.buf.length > MAX_HEADER_BYTES) this.fail("header too large");
        return;
      }
      const match = /^Content-Length:\s*(\d+)\s*$/im.exec(this.buf.subarray(0, headerEnd).toString("ascii"));
      if (!match) return this.fail("missing Content-Length header");
      const length = Number(match[1]);
      if (length > MAX_LSP_BODY_BYTES) return this.fail("body too large");
      const bodyStart = headerEnd + 4;
      if (this.buf.length < bodyStart + length) return;
      const raw = this.buf.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.buf = this.buf.subarray(bodyStart + length);
      let message: unknown;
      try {
        message = JSON.parse(raw);
      } catch {
        return this.fail("invalid JSON body");
      }
      this.onMessage(message);
    }
  }

  private fail(reason: string): void {
    this.failed = true;
    this.buf = Buffer.alloc(0);
    this.onError(new Error(`LSP framing: ${reason}`));
  }
}
