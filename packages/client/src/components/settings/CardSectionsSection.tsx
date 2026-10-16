/**
 * Settings › General › Session card sections — global on/off default per
 * session-card section, each row showing how many folders override it (so a
 * global flip never silently fails to take effect somewhere). Applies
 * immediately over WS (like the card legend menu), outside the unified Save
 * draft. Turning a section back ON sends `null` (inherit the built-in
 * visible default) so the global map stays sparse.
 * See change: configurable-session-card-sections (design D9).
 */
import { countFolderOverrides, resolveCardSectionVisible } from "@blackbelt-technology/pi-dashboard-shared/card-sections.js";
import { useId } from "react";
import { t as i18nT } from "../../lib/i18n/i18n.js";
import { type CardSectionGroup, type CardSectionMeta, useOfferedCardSections } from "../../lib/session/card-section-meta.js";
import { useCardSectionActions, useCardSectionPrefs } from "../../lib/state/CardSectionsContext.js";
import { FocusNotice } from "./FocusNotice.js";

const GROUPS: CardSectionGroup[] = ["builtin", "plugin", "lines", "directory", "effects"];

function groupTitle(g: CardSectionGroup): string {
  if (g === "builtin") return i18nT("cardSections.groupSections", undefined, "Sections");
  if (g === "plugin") return i18nT("cardSections.groupPlugin", undefined, "Plugin sections");
  if (g === "directory") return i18nT("cardSections.groupDirectory", undefined, "Directory card");
  if (g === "effects") return i18nT("cardSections.groupEffects", undefined, "Effects");
  return i18nT("cardSections.groupLines", undefined, "Card lines");
}

export function CardSectionsSection() {
  const prefs = useCardSectionPrefs();
  const actions = useCardSectionActions();
  const offered = useOfferedCardSections();

  return (
    <div data-testid="card-sections-settings">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 pb-1 border-b border-[var(--border-secondary)]">
        {i18nT("cardSections.globalTitle", undefined, "Session card sections")}
      </h2>
      <p className="text-xs text-[var(--text-tertiary)] mb-2">
        {i18nT(
          "cardSections.globalLead",
          undefined,
          "Default for all folders. Folders can override each section in Directory Settings › Session cards. Changes apply immediately.",
        )}
      </p>
      <FocusNotice />
      {GROUPS.map((g) => {
        const items = offered.filter((m) => m.group === g);
        if (items.length === 0) return null;
        return (
          <section key={g} aria-label={groupTitle(g)} className="mb-4" data-testid={`card-sections-global-group-${g}`}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {groupTitle(g)}
            </h3>
            <div className="space-y-1.5">
              {items.map((m) => (
                <GlobalRow
                  key={m.id}
                  meta={m}
                  // Normal (Focus-off) value: global → legacy parent → visible.
                  visible={resolveCardSectionVisible({ global: prefs.global }, undefined, m.id)}
                  overrides={m.globalOnly ? 0 : countFolderOverrides(prefs, m.id)}
                  showCount={!m.globalOnly}
                  disabled={!actions.canWrite}
                  onToggle={(next) => {
                    if (!next) return actions.setVisibility(undefined, m.id, false);
                    // ON = inherit, unless inheriting would still resolve hidden
                    // (legacy parent off) — then write an explicit `true`.
                    const inherited = resolveCardSectionVisible(
                      { global: { ...prefs.global, [m.id]: undefined as never } },
                      undefined,
                      m.id,
                    );
                    actions.setVisibility(undefined, m.id, inherited ? null : true);
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function GlobalRow({
  meta,
  visible,
  overrides,
  showCount = true,
  onToggle,
  disabled,
}: {
  meta: CardSectionMeta;
  visible: boolean;
  overrides: number;
  showCount?: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const hint = !showCount
    ? meta.description()
    : overrides > 0
      ? i18nT("cardSections.folderOverrideCount", { count: overrides }, "{count} folder(s) override this")
      : null;
  return (
    <div className="flex items-start justify-between gap-6 py-2.5" data-testid={`card-sections-global-${meta.id}`}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm text-[var(--text-secondary)]">
          {meta.label()}
        </label>
        {hint != null && (
          <p id={hintId} className="text-[11px] leading-snug text-[var(--text-tertiary)]" data-testid={`card-sections-global-count-${meta.id}`}>
            {hint}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={visible}
        aria-describedby={hint != null ? hintId : undefined}
        disabled={disabled}
        onClick={() => onToggle(!visible)}
        className={`focus-ring relative mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${visible ? "bg-[var(--accent-solid)]" : "bg-[var(--text-muted)]"}`}
      >
        <span className={`h-3 w-3 rounded-full bg-white transition-transform ${visible ? "translate-x-3" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
