/** Renders a unified diff string with add/remove/hunk colouring. No `diff` dependency. */
export function UnifiedDiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n");

  return (
    <div className="font-mono text-code leading-relaxed overflow-auto max-h-80">
      {lines.map((line, i) => {
        let className = "text-[var(--text-tertiary)] px-2";
        if (line.startsWith("+++") || line.startsWith("---")) {
          className = "text-[var(--text-tertiary)] px-2 font-bold";
        } else if (line.startsWith("@@")) {
          className = "text-[var(--accent-blue-text)] px-2 bg-[color-mix(in_srgb,var(--accent-blue)_15%,transparent)]";
        } else if (line.startsWith("+")) {
          className = "text-[var(--accent-green-text)] px-2 bg-[color-mix(in_srgb,var(--accent-green)_15%,transparent)]";
        } else if (line.startsWith("-")) {
          className = "text-[var(--accent-red-text)] px-2 bg-[color-mix(in_srgb,var(--accent-red)_15%,transparent)]";
        }
        return (
          <div key={i} className={className}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}
