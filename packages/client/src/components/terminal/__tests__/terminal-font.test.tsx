import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InlineTerminalCard } from "../InlineTerminalCard.js";
import { TerminalView } from "../TerminalView.js";

const mocks = vi.hoisted(() => {
  const terminals: Array<{
    options: Record<string, unknown>;
    open: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];
  return { terminals, fit: vi.fn() };
});

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 91;
    rows = 17;
    open = vi.fn();
    write = vi.fn();
    dispose = vi.fn();
    focus = vi.fn();
    loadAddon = vi.fn();
    onTitleChange = vi.fn();
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.terminals.push(this);
    }
  },
}));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: class { fit = mocks.fit; } }));
vi.mock("@xterm/addon-attach", () => ({ AttachAddon: class { dispose = vi.fn(); } }));
vi.mock("../../../lib/pairing/device-auth.js", () => ({ getApiBearer: () => null }));
vi.mock("../../../lib/i18n/i18n.js", () => ({ t: (_key: string, _args: unknown, fallback: string) => fallback }));

class Socket extends EventTarget {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  constructor(_url: string) {
    super();
    Socket.instances.push(this);
  }
}

let resolveFont: () => void;
let rejectFont: () => void;
let load: ReturnType<typeof vi.fn>;
const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");

beforeEach(() => {
  mocks.terminals.length = 0;
  mocks.fit.mockClear();
  Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  load = vi.fn(() => new Promise<void>((resolve, reject) => {
    resolveFont = resolve;
    rejectFont = reject;
  }));
  Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
  else Reflect.deleteProperty(document, "fonts");
});

describe("terminal font readiness", () => {
  it("opens live terminal after font load and sends fitted dimensions without reconnecting", async () => {
    const view = render(<TerminalView terminalId="live" visible />);
    const terminal = mocks.terminals[0];
    expect(terminal.options).toMatchObject({
      fontFamily: "'Iosevka Term', Menlo, Monaco, monospace",
      fontSize: 13,
      fontWeight: "normal",
      lineHeight: 1.35,
      cursorBlink: false,
    });
    expect(load).toHaveBeenCalledWith('13px "Iosevka Term"');
    expect(terminal.open).not.toHaveBeenCalled();
    expect(Socket.instances).toHaveLength(0);
    await act(async () => resolveFont());
    expect(terminal.open).toHaveBeenCalledOnce();
    const socket = Socket.instances[0];
    act(() => socket.dispatchEvent(new Event("open")));
    expect(mocks.fit).toHaveBeenCalledOnce();
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: "resize", cols: 91, rows: 17 }));
    view.rerender(<TerminalView terminalId="live" visible={false} />);
    view.rerender(<TerminalView terminalId="live" visible />);
    expect(Socket.instances).toHaveLength(1);
    expect(load).toHaveBeenCalledOnce();
  });

  it("fits frozen transcript before replay using loaded regular Iosevka metrics", async () => {
    render(<InlineTerminalCard terminalId="closed" closed transcript="saved output" onClose={vi.fn()} />);
    const terminal = mocks.terminals[0];
    expect(terminal.options).toMatchObject({
      fontFamily: "'Iosevka Term', Menlo, Monaco, monospace",
      fontSize: 13, fontWeight: "normal", lineHeight: 1.35, cursorBlink: false, disableStdin: true,
    });
    expect(load).toHaveBeenCalledWith('13px "Iosevka Term"');
    expect(terminal.write).not.toHaveBeenCalled();
    await act(async () => resolveFont());
    expect(mocks.fit).toHaveBeenCalledOnce();
    expect(terminal.write).toHaveBeenCalledWith("saved output");
    expect(mocks.fit.mock.invocationCallOrder[0]).toBeLessThan(terminal.write.mock.invocationCallOrder[0]);
    expect(Socket.instances).toHaveLength(0);
  });

  for (const frozen of [false, true]) {
    it(`ignores font resolution after ${frozen ? "frozen" : "live"} disposal`, async () => {
      const view = render(<InlineTerminalCard terminalId="gone" closed={frozen} transcript="output" onClose={vi.fn()} />);
      const terminal = mocks.terminals[0];
      view.unmount();
      await act(async () => resolveFont());
      expect(terminal.dispose).toHaveBeenCalledOnce();
      expect(terminal.open).not.toHaveBeenCalled();
      expect(terminal.write).not.toHaveBeenCalled();
      expect(mocks.fit).not.toHaveBeenCalled();
      expect(Socket.instances).toHaveLength(0);
    });

    it(`uses fallback metrics when ${frozen ? "frozen" : "live"} font loading fails`, async () => {
      render(<InlineTerminalCard terminalId="fallback" closed={frozen} transcript="output" onClose={vi.fn()} />);
      await act(async () => rejectFont());
      expect(mocks.terminals[0].open).toHaveBeenCalledOnce();
    });
  }
});
