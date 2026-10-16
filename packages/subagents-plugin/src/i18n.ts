/**
 * Subagents plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared
 * as `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest) and the
 * shell merges it under `plugin.subagents.*`. Component code resolves keys via
 * the scoped `useT()` hook, which auto-prefixes `plugin.subagents.`.
 *
 * hu is the only non-English catalog. {var} placeholders are
 * preserved verbatim so `t(key, vars)` can interpolate.
 *
 * See change: make-all-ui-text-i18n.
 */
export const catalog = {
  hu: {
    subagentNotFound: "Nem található alügynök ebben a munkamenetben.",
    result: "Eredmény",
    noDetailYet: "Még nincs részlet.",
    loadingParentSession: "Szülő munkamenet betöltése…",
    parentSessionNotFound: "A szülő munkamenet nem található",
    parentSessionNotFoundBody:
      "Lehet, hogy archiválták vagy törölték. Zárd be ezt a lapot — az a munkamenet, amelyből ezt az alügynököt indították, már nem érhető el az irányítópulton.",
    closeTab: "Lap bezárása",
    back: "Vissza",
    subagentBreadcrumb: "Alügynök · {label}",
    subagentNotFoundCleared:
      "Az alügynök nem található — lehet, hogy törölték a szülő munkamenet előzményeiből.",
    subagentInspectorHeading: "Alügynök-vizsgáló",
    producerSettingsPre: "Beállítások a(z) ",
    producerSettingsPost: " producerhez.",
    rolesDepConfigurePre: "Állítsd be a(z) ",
    rolesDepPluginResolve: " plugint, hogy a beépített ",
    rolesDepAgentResolve: " ügynök fel tudja oldani a(z) ",
    rolesDepIfNoModel: " aliast. Ha nincs modell hozzárendelve a(z) ",
    rolesDepAgentsUsing: " aliashoz, a(z) ",
    rolesDepAliasesReport:
      " aliast használó ügynökök „még nincs beállítva” hibát jelentenek indításkor — az Alügynökök továbbra is betöltődik.",
    forkContextLabel: "A szülő kontextusának elágaztatása minden alügynökbe",
    forkContextDescription:
      "Bekapcsolva az alügynök a szülő legutóbbi köreinek tömörített másolatát örökli. Kikapcsolva minden alügynök üres beszélgetéssel indul (izolált).",
    saveError: "HTTP {status}: {detail}",
    "noRuns": "Még nincs alügynök-futás.",
    "closed": "lezárva",
    "refresh": "Frissítés",
    "notConnected": "A munkamenet nincs kapcsolódva.",
    "waitingForReply": "Várakozás a pi válaszára…",
    "task": "Feladat",
    "transcript": "Átirat",
    "finalOutput": "Végeredmény",
    "truncatedNote": "A pi egy részt csonkolt.",
  },
};
