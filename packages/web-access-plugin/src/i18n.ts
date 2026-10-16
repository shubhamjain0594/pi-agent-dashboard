/**
 * Web-access plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared as
 * `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest); the shell
 * merges it under `plugin.web-access.*`. Components resolve keys via the scoped
 * `useT()` hook. English lives at the call sites as the `t(key, vars, fallback)`
 * fallback. `hu` is the only non-English catalog.
 *
 * See change: render-unclaimed-custom-entries.
 */
export const catalog = {
  hu: {
    labelSearch: "Webes keresés",
    labelFetch: "Weboldal-letöltés",
    labelResearch: "Webes kutatás",
    labelGeneric: "Webes keresési találatok",
    queriesOne: "{count} lekérdezés",
    queriesOther: "{count} lekérdezés",
    resultsOne: "{count} találat",
    resultsOther: "{count} találat",
    urlsOne: "{count} URL",
    urlsOther: "{count} URL",
    expand: "Bejegyzés kibontása",
    collapse: "Bejegyzés összecsukása",
    loading: "Részletek betöltése…",
    detailsUnavailable: "A teljes részletek nem érhetők el ({error}). A beszélgetéssel mentett összegzés látható.",
    moreItems: "még {count} elem",
    skippedItemsOne: "{count} elem nem jeleníthető meg",
    skippedItemsOther: "{count} elem nem jeleníthető meg",
    failedOne: "{count} sikertelen",
    failedOther: "{count} sikertelen",
    opensInNewTab: " (új lapon nyílik meg)",
    noResults: "Nincs találat",
    answerLabel: "Válasz",
    providerLabel: "Szolgáltató: {provider}",
    sizeChars: "{count} karakter",
  },
} as const;
