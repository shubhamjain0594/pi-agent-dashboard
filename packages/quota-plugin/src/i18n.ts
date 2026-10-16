/**
 * Provider Quota plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The shell merges this under `plugin.quota.*`; component code resolves keys
 * via the scoped `useT()` hook (auto-prefixes `plugin.quota.`) with an English
 * fallback passed inline. hu is the only non-English catalog. {var} placeholders are
 * preserved verbatim.
 */
export const catalog = {
  hu: {
    heading: "Szolgáltatói kvóta",
    tosTitle: "Figyelmeztetés",
    tosBody:
      "A kvótakövetés nem dokumentált szolgáltatói végpontokat hív, ami sértheti a szolgáltató feltételeit. Csak személyes/helyi használatra.",
    now: "most",
    providersLegend: "Engedélyezés szolgáltatónként",
    enableQuota: "Kvótakövetés engedélyezése",
    all: "Összes",
    onPace: "ütemben",
    overBy: "túllépés {pct}%",
    stale: "visszaállítás függőben",
    unavailable: "kvóta nem elérhető",
    projected: "Előrejelzés",
    reasonNoCredential: "nincs bejelentkezés",
    reasonRejected: "a szolgáltató elutasította a kérést",
    reasonNoData: "nincs jelentett kvóta",
    reasonNoAdapter: "nem támogatott",
    resetsIn: "{t} múlva nullázódik",
    retained: "nem élő",
    retainedBody: "A legutóbbi frissítés sikertelen volt, az utoljára ismert értékek láthatók.",
    quota: "Kvóta",
    noQuota: "{modelId} · nincs kvóta",
    chipAria: "{provider} kvóta, {windows}",
  },
} as const;
