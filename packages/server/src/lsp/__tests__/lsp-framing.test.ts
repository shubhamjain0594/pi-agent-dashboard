import { describe, expect, it } from "vitest";
import { encodeLspMessage, LspFrameParser } from "../lsp-framing.js";

function collect() {
  const messages: unknown[] = [];
  const errors: Error[] = [];
  const parser = new LspFrameParser((m) => messages.push(m), (e) => errors.push(e));
  return { parser, messages, errors };
}

describe("LSP framing", () => {
  it("round-trips a message fed one byte at a time", () => {
    const { parser, messages, errors } = collect();
    const frame = encodeLspMessage({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    for (const byte of frame) parser.push(Buffer.from([byte]));
    expect(messages).toEqual([{ jsonrpc: "2.0", id: 1, result: { ok: true } }]);
    expect(errors).toEqual([]);
  });

  it("parses two messages delivered in one chunk", () => {
    const { parser, messages } = collect();
    parser.push(Buffer.concat([encodeLspMessage({ id: 1 }), encodeLspMessage({ id: 2 })]));
    expect(messages).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("uses byte length, not character length, for multi-byte bodies", () => {
    const { parser, messages } = collect();
    parser.push(encodeLspMessage({ text: "héllo — 🚀" }));
    expect(messages).toEqual([{ text: "héllo — 🚀" }]);
  });

  it("reports a missing Content-Length header and stops parsing", () => {
    const { parser, messages, errors } = collect();
    parser.push(Buffer.from("X-Other: 1\r\n\r\n{}"));
    parser.push(encodeLspMessage({ id: 9 }));
    expect(messages).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/missing Content-Length/);
  });

  it("refuses an oversized body declaration", () => {
    const { parser, errors } = collect();
    parser.push(Buffer.from("Content-Length: 999999999999\r\n\r\n"));
    expect(errors[0].message).toMatch(/body too large/);
  });

  it("refuses an unbounded header", () => {
    const { parser, errors } = collect();
    parser.push(Buffer.alloc(9 * 1024, 0x61));
    expect(errors[0].message).toMatch(/header too large/);
  });
});
