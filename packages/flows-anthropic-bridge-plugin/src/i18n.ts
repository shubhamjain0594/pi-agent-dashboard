/**
 * Anthropic Messages Bridge plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared
 * as `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest) and the
 * shell merges it under `plugin.flows-anthropic-bridge.*`. Component code
 * resolves keys via the scoped `useT()` hook, which auto-prefixes
 * `plugin.flows-anthropic-bridge.`.
 *
 * hu is the only non-English catalog. {var} placeholders are
 * preserved verbatim so `t(key, vars)` can interpolate.
 *
 * See change: make-all-ui-text-i18n.
 */
export const catalog = {
  hu: {
    heading: "pi-flows · Anthropic üzenet-híd",
    descForwards: "Továbbítja a",
    descHooks:
      "horgokat minden pi-flows ügynök-alfolyamatba. Csak akkor aktiválódik, ha mindkét társ (",
    descAnd: "és",
    descResolve: ") feloldódik a pi folyamatban.",
    bannerNoSessions:
      "Még egy pi munkamenet sem jelez. Indíts egy pi munkamenetet az állapot megtekintéséhez.",
    bannerActive: "A híd minden pi munkamenetben aktív.",
    bannerDegraded:
      "Egy vagy több társ nem érhető el. Lásd a munkamenetenkénti részleteket alább.",
    refresh: "Frissítés",
    colStatus: "Állapot",
    peerMissing: "hiányzik",
    gateOverrides: "Kapu felülbírálások",
    forceLabel: "Kapu kényszerített nyitása (bármely anthropic-messages modell — beállítja",
    disableLabel: "Híd teljes letiltása (beállítja",
    save: "Mentés",
  },
};
