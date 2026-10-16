import React, { useEffect, useState } from "react";
import { t as i18nT } from "../../lib/i18n/i18n.js";

/** Elapsed loading time after which the slow-startup hint is shown. */
const SLOW_STARTUP_SECONDS = 15;

interface PlaceholderSessionCardProps {
  /** Epoch ms when Pi's process started; enables the loading-extensions line and its elapsed ticker. */
  loadingSince?: number;
}

/**
 * Skeleton placeholder card shown while a new session is being spawned.
 * Matches SessionCard dimensions with pulse animation loading bars.
 * With `loadingSince`, shows the elapsed extension-loading time, ticking once a second.
 */
export function PlaceholderSessionCard({ loadingSince }: PlaceholderSessionCardProps) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (loadingSince === undefined) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [loadingSince]);

  const elapsedSeconds = loadingSince === undefined ? 0 : Math.max(0, Math.floor((now - loadingSince) / 1000));

  return (
    <div
      data-testid="placeholder-session-card"
      className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-surface)] p-3 animate-pulse"
    >
      {/* Status dot + name bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
        <div className="h-3 w-32 rounded bg-[var(--text-muted)]/30" />
      </div>
      {/* Subtitle bar */}
      <div className="h-2.5 w-24 rounded bg-[var(--text-muted)]/20 mb-2" />
      {/* Loading text */}
      {loadingSince === undefined ? (
        <div className="text-[10px] text-[var(--text-tertiary)]">{i18nT("session.startingNewSession", undefined, "Starting new session…")}</div>
      ) : (
        <>
          <div className="text-[10px] text-[var(--text-tertiary)]">
            {i18nT("session.loadingExtensions", { seconds: elapsedSeconds }, "Pi started — loading extensions… {seconds}s")}
          </div>
          {elapsedSeconds >= SLOW_STARTUP_SECONDS && (
            <div className="text-[10px] text-[var(--text-tertiary)]">
              {i18nT("session.loadingExtensionsSlow", undefined, "Still loading. Many extensions can make startup slower.")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
