/**
 * Task 3.4 (bridge side) for change: fix-stuck-tool-card-on-dropped-event.
 *
 * The bridge buffers outgoing messages while the WS is not OPEN in a bounded
 * ring; on overflow `buffer.shift()` evicts the oldest. This suite proves the
 * eviction is COUNTED (`getDroppedBufferedCount`) for heartbeat diagnostics,
 * without writing background transport warnings into Pi's terminal UI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionManager } from "../connection.js";

class MockWebSocket {
  public url: string;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sentMessages: string[] = [];
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(data: string) { this.sentMessages.push(data); }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("ConnectionManager dropped-frame instrumentation", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts each ring-buffer eviction on overflow", () => {
    const cm = new ConnectionManager({
      url: "ws://localhost:9999",
      WebSocketImpl: MockWebSocket as any,
      maxBufferSize: 10,
    });
    // Never connect → everything buffers. 15 sends over a cap of 10 → 5 evicted.
    for (let i = 0; i < 15; i++) {
      cm.send({ type: "event_forward", sessionId: "s1", event: { i } });
    }
    expect(cm.getDroppedBufferedCount()).toBe(5);
  });

  it("starts at zero and stays zero under the cap", () => {
    const cm = new ConnectionManager({
      url: "ws://localhost:9999",
      WebSocketImpl: MockWebSocket as any,
      maxBufferSize: 10,
    });
    for (let i = 0; i < 10; i++) cm.send({ type: "event_forward", event: { i } });
    expect(cm.getDroppedBufferedCount()).toBe(0);
  });

  it("keeps repeated overflows out of the terminal while retaining diagnostic counts", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cm = new ConnectionManager({
      url: "ws://localhost:9999",
      WebSocketImpl: MockWebSocket as any,
      maxBufferSize: 2,
    });
    const clock = vi.spyOn(Date, "now").mockReturnValue(10_000);
    for (let i = 0; i < 6; i++) {
      cm.send({ type: "event_forward", sessionId: "s1", event: { i } });
    }
    clock.mockReturnValue(20_000);
    for (let i = 6; i < 10; i++) {
      cm.send({ type: "event_forward", sessionId: "s1", event: { i } });
    }
    expect(warnSpy).not.toHaveBeenCalled();
    expect(cm.getDroppedBufferedCount()).toBe(8);
  });

  it("still replays the newest retained frames when the connection returns", () => {
    const cm = new ConnectionManager({ url: "ws://localhost:9999", WebSocketImpl: MockWebSocket, maxBufferSize: 2, watchdogTimeout: 0 });
    for (let i = 0; i < 6; i++) cm.send({ type: "event_forward", sessionId: "s1", event: { i } });
    cm.connect();
    const ws = MockWebSocket.instances[0];
    ws.readyState = 1;
    ws.onopen?.();
    expect(ws.sentMessages.map((frame) => JSON.parse(frame).event.i)).toEqual([4, 5]);
    expect(cm.getDroppedBufferedCount()).toBe(4);
    cm.disconnect();
  });
});
