import { createContext, type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { createPortal } from "react-dom";

/** Stable host registration keeps composer keystrokes out of ChatView's memo boundary. */
export const ConversationComposerHost = createContext<Dispatch<SetStateAction<HTMLDivElement | null>> | null>(null);

export function ConversationLayout({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ConversationComposerHost.Provider value={setHost}>
      {children}
      {/* Keep the composer usable when the chat's error boundary has no scrollport. */}
      {host ? createPortal(footer, host) : footer}
    </ConversationComposerHost.Provider>
  );
}
