/**
 * Flows plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared
 * as `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest) and the
 * shell merges it under `plugin.flows.*`. Component code resolves keys via the
 * scoped `useT()` hook, which auto-prefixes `plugin.flows.`.
 *
 * hu is the only non-English catalog. {var} placeholders are
 * preserved verbatim so `t(key, vars)` can interpolate.
 *
 * See change: make-all-ui-text-i18n.
 */
export const catalog = {
  hu: {
    abort: "Megszakítás",
    delete: "Törlés",
    run: "Futtatás",
    abortRunningFlow: "Futó folyamat megszakítása",
    back: "Vissza",
    expandGraph: "Gráf kibontása",
    flowGraph: "Folyamatgráf",
    result: "Eredmény",
    inputs: "Bemenetek",
    dismiss: "Bezárás",
    flowsHeading: "Folyamatok",
    editModeLabel: "Szerkesztő mód",
    runFlowTitle: "Folyamat futtatása: {flowName}",
    taskPlaceholder: "Írd le a feladatot (opcionális)…",
    summary: "Összefoglaló",
    waitingToStart: "Indulásra vár…",
    noActivityYet: "Még nincs tevékenység",
    closeAgentDetail: "{name} részleteinek bezárása",
    viewAgentDetail: "{name} részleteinek megtekintése",
    details: "Részletek",
    stepsCount: "{done}/{total} lépés",
    toggleAutonomousMode: "Autonóm mód váltása",
    abortFlow: "Folyamat megszakítása",
    newFlowOption: "+ Új folyamat",
    newFlowOptionDesc: "Új folyamat készítése az edit-flow készséggel",
    runFlowButton: "Folyamat futtatása…",
    openFlowButton: "Folyamat megnyitása…",
    openFlowDialogTitle: "Folyamat megnyitása",
    openFlowDisabledRunning: "Egy folyamat fut",
    flowNotStarted: "nincs elindítva",
    runFlow: "Futtatás",
    closeAttachedFlow: "Bezárás",
    flowDefinitionLoadError: "A folyamatdefiníciós fájl nem érhető el",
    flowNoLongerAvailable: "már nem érhető el",
    flowLoading: "betöltés…",
    flowRunRejected: "Az indítás elutasítva",
    flowRunSendFailed: "A folyamat nem indítható el",
    openHandlerInEditor: "Kezelő megnyitása a szerkesztőben",
    openSourceInEditor: "{name} forrásának megnyitása a szerkesztőben",
    openFlowYamlInEditor: "{name} YAML megnyitása a szerkesztőben",
    newEditButton: "Új / Szerkesztés…",
    runFlowDialogTitle: "Folyamat futtatása",
    searchFlows: "Folyamatok keresése…",
    noFlowsAvailable: "Nincs elérhető folyamat",
    newEditFlowTitle: "Új / Folyamat szerkesztése",
    pickFlowToEdit: "Válassz folyamatot szerkesztésre, vagy + Új folyamat…",
    noFlowsYet: "Még nincs folyamat — válaszd a + Új folyamat lehetőséget",
    deleteFlowTitle: "Folyamat törlése",
    deleteFlowConfirm:
      'Törlöd a(z) "{name}" folyamatot? Ez eltávolítja a folyamatfájlt és a hozzá tartozó ügynököket.',
  },
};
