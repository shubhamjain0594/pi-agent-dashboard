import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { memo, useContext, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationComposerHost, ConversationLayout } from "../chat/ConversationLayout.js";
import { ChatView } from "../chat/ChatView.js";
import { ThemeProvider } from "../settings/ThemeProvider.js";
import { createInitialState } from "../../lib/chat/event-reducer.js";

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches: false, media, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  Element.prototype.scrollTo = vi.fn();
});

let transcriptRenders = 0;
const Transcript = memo(function Transcript() {
  transcriptRenders++;
  const setHost = useContext(ConversationComposerHost);
  return <div data-testid="scrollport"><div>Transcript</div><div ref={setHost} data-testid="composer-host" /></div>;
});

function Conversation({ name }: { name: string }) {
  const [draft, setDraft] = useState("");
  return (
    <ConversationLayout footer={<input aria-label={name} value={draft} onChange={(e) => setDraft(e.target.value)} />}>
      <Transcript />
    </ConversationLayout>
  );
}

describe("ConversationLayout", () => {
  it("mounts composer furniture inside the transcript's native scrollport", () => {
    render(<Conversation name="Draft" />);
    expect(screen.getByTestId("composer-host").contains(screen.getByRole("textbox"))).toBe(true);
    expect(screen.getByTestId("scrollport").contains(screen.getByRole("textbox"))).toBe(true);
  });

  it("keeps composer typing out of the memoized transcript render path", () => {
    render(<Conversation name="Draft" />);
    const before = transcriptRenders;
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "follow-up" } });
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("follow-up");
    expect(transcriptRenders).toBe(before);
  });

  it("keeps independent conversation hosts isolated", () => {
    const { container } = render(<><Conversation name="First" /><Conversation name="Second" /></>);
    const hosts = container.querySelectorAll('[data-testid="composer-host"]');
    expect(hosts[0].contains(screen.getByRole("textbox", { name: "First" }))).toBe(true);
    expect(hosts[1].contains(screen.getByRole("textbox", { name: "Second" }))).toBe(true);
  });

  it("hosts the actual composer after transcript content in the same native scrollport", () => {
    render(<ThemeProvider><ConversationLayout footer={<input aria-label="Draft" />}>
      <ChatView state={createInitialState()} toolContext={{}} />
    </ConversationLayout></ThemeProvider>);
    const scrollport = screen.getByTestId("chat-scroll-container");
    const content = screen.getByTestId("chat-transcript-content");
    const host = screen.getByTestId("conversation-composer-host");
    expect(content.parentElement).toBe(scrollport);
    expect(host.previousElementSibling).toBe(content);
    expect(host.contains(screen.getByRole("textbox"))).toBe(true);
    expect(scrollport.style.overflowAnchor).toBe("none");
    expect(scrollport.querySelectorAll('[data-testid="chat-scroll-container"]')).toHaveLength(0);
  });

  it("preserves composer-local state across A → B → A session switches", () => {
    function Footer() {
      const [value, setValue] = useState("");
      return <input aria-label="Local composer state" value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    const state = createInitialState();
    const context = {};
    const view = (sessionId: string) => <ThemeProvider>
      <ConversationLayout footer={<Footer />}>
        <ChatView sessionId={sessionId} state={state} toolContext={context} />
      </ConversationLayout>
    </ThemeProvider>;
    const { rerender } = render(view("A"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "keep delivery mode" } });
    const host = screen.getByTestId("conversation-composer-host");
    rerender(view("B"));
    rerender(view("A"));
    expect(screen.getByTestId("conversation-composer-host")).toBe(host);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("keep delivery mode");
  });

  it("updates the footer minimum when furniture expands inside an already capped host", async () => {
    const notifications = new Map<Element, () => void>();
    vi.stubGlobal("ResizeObserver", class {
      private callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) { this.callback = callback; }
      observe(target: Element) { notifications.set(target, () => this.callback([], this as unknown as ResizeObserver)); }
      unobserve(target: Element) { notifications.delete(target); }
      disconnect() {}
    });
    try {
      render(<ThemeProvider><ConversationLayout footer={<>
        <details data-testid="tools"><summary>Session tools</summary><div>Expanded tools</div></details>
        <div data-testid="composer-root">Composer</div>
      </>}><ChatView state={createInitialState()} toolContext={{}} /></ConversationLayout></ThemeProvider>);
      const footer = screen.getByTestId("conversation-composer-host");
      const composer = screen.getByTestId("composer-root");
      const scrollport = screen.getByTestId("chat-scroll-container");
      Object.defineProperty(footer, "scrollHeight", { configurable: true, get: () => 118 });
      composer.getBoundingClientRect = () => ({ height: 72 } as DOMRect);
      // The footer stays capped at 72px; only its fixed tools row resizes.
      await waitFor(() => expect(notifications.get(screen.getByTestId("tools"))).toBeTypeOf("function"));
      notifications.get(screen.getByTestId("tools"))!();
      expect(scrollport.parentElement?.style.getPropertyValue("--chat-footer-min-height")).toBe("118px");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps standalone ChatView usable without a composer host", () => {
    render(<ThemeProvider><ChatView state={createInitialState()} toolContext={{}} /></ThemeProvider>);
    expect(screen.getByTestId("chat-scroll-container")).toBeTruthy();
    expect(screen.queryByTestId("conversation-composer-host")).toBeNull();
  });

  it("leaves the composer available when a transcript has no host", () => {
    render(<ConversationLayout footer={<input aria-label="Draft" />}><div>Chat unavailable</div></ConversationLayout>);
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});
