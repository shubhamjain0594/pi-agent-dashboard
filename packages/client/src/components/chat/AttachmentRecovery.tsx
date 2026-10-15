import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { attachmentOriginalUrl } from "../../lib/chat/attachment-original-url.js";

interface Props {
  sessionId?: string;
  attachmentId?: string;
  failed: boolean;
  /** Normal fitted-image URL for a settled, reference-backed attachment. */
  displaySource?: string;
  index: number;
  onImageLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onZoom: (src: string) => void;
}

// Identity changes remount the attempt, invalidating its timers and callbacks.
export function AttachmentRecovery(props: Props) {
  return <RecoveryAttempt key={JSON.stringify([props.sessionId, props.attachmentId, props.displaySource])} {...props} />;
}

function RecoveryAttempt({ sessionId, attachmentId, failed, displaySource, index, onImageLoad, onZoom }: Props) {
  const original = displaySource ?? attachmentOriginalUrl(sessionId, attachmentId);
  const [phase, setPhase] = useState<"waiting" | "loading" | "loaded" | "unavailable">(displaySource ? "loading" : failed ? (original ? "loading" : "unavailable") : "waiting");
  const [attempt, setAttempt] = useState(0);
  const activeAttempt = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "waiting") return;
    if (failed) {
      setPhase(original ? "loading" : "unavailable");
      return;
    }
    const timer = setTimeout(() => setPhase(original ? "loading" : "unavailable"), 3000);
    return () => clearTimeout(timer);
  }, [phase, failed, original]);

  useLayoutEffect(() => {
    if (phase !== "loading") return;
    activeAttempt.current = attempt;
    const timer = setTimeout(() => {
      activeAttempt.current = null;
      setPhase("unavailable");
    }, 10000);
    return () => {
      activeAttempt.current = null;
      clearTimeout(timer);
    };
  }, [phase, attempt]);

  if (phase === "unavailable") {
    return (
      <div data-testid="attachment-failed" className="min-w-[80px] min-h-[80px] w-[120px] rounded border border-red-500/40 bg-red-500/5 flex flex-col items-center justify-center text-[10px] text-red-300/70 text-center px-1">
        <span role="img" aria-label={`Attachment ${index + 1} failed to load`}>image unavailable</span>
        {original && <button type="button" className="underline p-2" aria-label={`Retry attachment ${index + 1}`} onClick={() => { setAttempt((value) => value + 1); setPhase("loading"); }}>Retry</button>}
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div data-testid="attachment-pending" role="img" className="min-w-[80px] min-h-[80px] w-[120px] h-[80px] rounded border border-white/20 bg-white/5 animate-pulse flex items-center justify-center text-[10px] text-white/40" aria-label={`Attachment ${index + 1} loading`}>loading</div>
    );
  }

  return (
    <button type="button" disabled={phase !== "loaded"} aria-label={`Zoom attachment ${index + 1}`} className="p-0 border-0 bg-transparent cursor-pointer leading-none" onClick={() => { if (original) onZoom(original); }}>
      <img
        key={attempt}
        src={original ?? undefined}
        data-testid="attachment-image"
        alt=""
        className={`max-w-[300px] max-h-[300px] ${phase === "loading" ? "min-w-[80px] min-h-[80px]" : ""} rounded border border-white/20 object-contain`}
        onLoad={(event) => {
          if (activeAttempt.current !== attempt) return;
          activeAttempt.current = null;
          setPhase("loaded");
          // Native image load, like the fitted path, measures synchronously
          // while SyntheticEvent.currentTarget still names this image.
          onImageLoad?.(event);
        }}
        onError={() => {
          if (activeAttempt.current !== attempt) return;
          activeAttempt.current = null;
          setPhase("unavailable");
        }}
      />
    </button>
  );
}
