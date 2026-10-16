import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChatView } from "../../packages/client/src/components/chat/ChatView.js";
import { CommandInput } from "../../packages/client/src/components/chat/CommandInput.js";
import { ConversationLayout } from "../../packages/client/src/components/chat/ConversationLayout.js";
import { ThemeProvider, useThemeContext } from "../../packages/client/src/components/settings/ThemeProvider.js";
import { createInitialState } from "../../packages/client/src/lib/chat/event-reducer.js";
import "../../packages/client/src/index.css";
import "../../packages/client/src/styles/conversation.css";

const toolContext = {};
function Preview() {
  const [count, setCount] = useState(120);
  const [draft, setDraft] = useState("");
  const [queue, setQueue] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [session, setSession] = useState("scroll-preview-A");
  const [largeHeader, setLargeHeader] = useState(false);
  const theme = useThemeContext();
  const state = useMemo(() => {
    const next = createInitialState();
    next.messages = Array.from({ length: count }, (_, i) => ({
      id: `scroll-preview-${i}`, role: i % 2 ? "assistant" : "user", timestamp: 1792100000000 + i * 1000,
      content: i % 2
        ? `### Scrolling check ${i + 1}\n\nThe native scrollbar spans the whole conversation, including the anchored composer. Scroll up to read earlier replies without being pulled back to the latest message.\n\n- The composer stays available.\n- The last reply remains above it.\n- Expanded drafts keep their own height budget.\n\nThis is the end of reply ${i + 1}.`
        : `Check the conversation layout at message ${i + 1}.`,
    }));
    if (streaming) next.streamingText = "Incoming reply. Scroll upward to pause auto-follow.";
    return next;
  }, [count, streaming]);
  return (
    <div className="desktop-workbench" style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border-secondary)] p-2 text-xs">
        <strong className="mr-auto">Conversation scrolling</strong>
        <button onClick={() => theme.setPreference(theme.resolved === "dark" ? "light" : "dark")}>Theme</button>
        <button onClick={() => theme.setThemeName(theme.themeName === "base" ? "nord" : "base")}>Palette</button>
        <button onClick={() => setCount(count > 2 ? 2 : 120)}>Short / long</button>
        <button onClick={() => setCount(0)}>Empty</button>
        <button onClick={() => setSession(session.endsWith("A") ? "scroll-preview-B" : "scroll-preview-A")}>Switch session</button>
        <button onClick={() => setLargeHeader(!largeHeader)}>Large header</button>
        <button onClick={() => setQueue(!queue)}>Queue</button>
        <button onClick={() => setReadOnly(!readOnly)}>Read-only</button>
        <button onClick={() => setStreaming(!streaming)}>Streaming</button>
        <button onClick={() => setCount((n) => n + 2)}>Append replies</button>
        <button onClick={() => setDraft(Array.from({ length: 40 }, (_, i) => `Draft line ${i + 1}`).join("\n"))}>Long draft</button>
      </header>
      <main data-testid="preview-pane" className="conversation-session flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="overflow-y-auto" style={{ flexShrink: 2, minHeight: 0 }}>
          {largeHeader && <div style={{ height: 480 }} className="border-b border-[var(--border-secondary)] p-3 text-sm">Expanded session header · This region can shrink and scroll independently.</div>}
        </div>
        <ConversationLayout footer={readOnly ? null : <>
          <details className="conversation-context-details shrink-0" data-testid="preview-tools">
            <summary>Session tools & display</summary>
            <div className="conversation-context-controls p-3 text-sm">
              <p>Session tools stay reachable when expanded inside a short pane.</p>
              <button className="border border-[var(--border-secondary)] rounded p-2" onClick={() => setStreaming(!streaming)}>Toggle preview streaming</button>
            </div>
          </details>
          {queue && <div data-testid="preview-queue" className="shrink-0 border-y border-[var(--border-secondary)] p-3 text-sm">Queued follow-up · Inspect the expanded composer and scrollbar.</div>}
          <CommandInput commands={[]} onSend={() => { setCount((n) => n + 2); setDraft(""); }} draft={draft} onDraftChange={setDraft} model="openai-codex/gpt-6.1-sol" onSelectModel={() => {}} />
        </>}>
          <ChatView sessionId={session} state={state} toolContext={toolContext} />
        </ConversationLayout>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<ThemeProvider><Preview /></ThemeProvider>);
