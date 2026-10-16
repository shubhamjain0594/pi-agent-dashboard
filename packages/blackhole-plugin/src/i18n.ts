/**
 * Blackhole plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared as
 * `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest) and the shell
 * merges it under `plugin.blackhole.*`. Component code resolves keys via the
 * scoped `useT()` hook, which auto-prefixes `plugin.blackhole.`.
 *
 * `hu` is the only non-English catalog.
 * English lives at the call sites as the `t(key, vars, fallback)` fallback.
 * Field labels/help are presentation DATA (field-groups.ts), not i18n keys.
 *
 * See change: add-blackhole-plugin.
 */
export const catalog = {
  hu: {
    noModelAssigned: "Nincs modell hozzárendelve",
    roleRefThinking: "gondolkodás",
    roleStatus_detached: "Leválasztva",
    roleStatus_dangling: "A szerep nincs hozzárendelve, az utolsó modell marad",
    levelDropped: "A(z) {level} gondolkodási szintet a(z) {model} nem támogatja, ezért a szint elhagyva.",
    roleDetachedHelp: "Ezt a helyet a vezérlőpulton kívül szerkesztették, ezért már nem követi a(z) {role} szerepet.",
    reattachRoleTo: "Újracsatolás ehhez: {role}",
    loadError: "A konfiguráció betöltése sikertelen: {error}",
    loading: "Betöltés…",
    notInstalledTitle: "A pi-blackhole nincs telepítve",
    notInstalledBody:
      "Ez az oldal a pi-blackhole bővítményt konfigurálja — egyesített algoritmikus tömörítés és megfigyelési memória. Telepítsd bármelyik pi munkamenetben, majd tölts újra.",
    parseErrorTitle: "A konfigurációs fájl nem értelmezhető — a szerkesztés le van tiltva",
    parseErrorBody:
      "A Blackhole minden beállítása ebben az egy fájlban van. Mivel nem olvasható, ennek az oldalnak nincs megjeleníthető értéke — az alapértelmezettek megjelenítése félrevezetően mutatná, mi fut valójában.",
    recheck: "Fájl újraellenőrzése",
    saveBlocked: "Mentés",
    intro: "A",
    introTail: "bővítmény tömörítési és megfigyelési memória beállításai.",
    file: "Fájl:",
    notCreated: "még nincs létrehozva",
    nUnmanaged: "{count} nem kezelt kulcs megőrizve",
    applyNote:
      "A pi-blackhole minden írás után újraolvassa ezt a fájlt, így a mentett változások maguktól elérik a futó munkameneteket. Az oldal által nem kezelt kulcsok (beleértve a _comment megjegyzéseket) érintetlenül megmaradnak.",
    fields: "mező",
    workerModels: "Munkamodellek",
    chains: "lánc",
    chainsHelp:
      "Minden munkás fentről lefelé próbálja a modelljeit. Az újrapróbálható hibát adó modellt a hűtési ablakára kihagyja, és a következő fut.",
    primary: "Elsődleges",
    inherit: "(öröklött)",
    overrideThinking: "Gondolkodási szint felülbírálása",
    addModelToChain: "Modell hozzáadása a(z) {worker} lánchoz",
    modelForEntryGroup: "Modell a(z) {worker} {index}. bejegyzéséhez",
    modelLabel: "Modell",
    levelDropNotice: "A(z) „{level}” gondolkodási szint felülbírálása elvetve: a kiválasztott modell nem támogatja a gondolkodást.",
    chainEmpty: "A munkás jelenleg csak az alap- / munkamenet-farokra oldódik fel.",
    registryUnavailable: "A modellregiszter nem érhető el ({reason}).",
    registryEmpty: "Nincsenek hitelesített modellek a regiszterben.",
    retryRegistry: "Újra",
    baseModelLabel: "Alapmodell",
    baseModelHelp: "Minden munkás közös tartaléka a munkamenet-modell előtt.",
    clearBaseModel: "Törlés",
    selectBaseModelPlaceholder: "Alapmodell kiválasztása…",
    cancelAddingModel: "Modell hozzáadásának megszakítása",
    selectModelToAddPlaceholder: "Hozzáadandó modell kiválasztása…",
    recommendedDefaultsLabel: "Ajánlott alapértelmezések használata",
    recommendedDefaultsHelp:
      "Az ajánlott alapértelmezések rugalmas flash-osztályú láncokat állítanak be (legfeljebb 3 modellt különböző szolgáltatóktól) az observer, reflector és dropper számára, valamint hibakeresési naplózást.",
    recommendedDefaultsDisabledUnavailable: "A regiszter nem érhető el. Az alapértelmezések beállítása le van tiltva.",
    recommendedDefaultsNoCandidate: "Nem található flash, haiku vagy mini modell a regiszterben.",
    recommendedDefaultsFewerThan3: "A 3 ajánlott modellből {count} beállítva az elérhető jelöltekből.",
    confirmReplaceChainsTitle: "Létező láncok cseréje?",
    confirmReplaceChainsBody:
      "Az ajánlott alapértelmezések alkalmazása felülírja az observer, reflector és dropper jelenlegi tartalékláncait legfeljebb 3 flash/haiku/mini modellel a hitelesített regiszterből.",
    confirmReplaceApply: "Alapértelmezések alkalmazása",
    notListedNotice: "Nincs a listában? Állíts be API-kulcsokat a Beállítások > Szolgáltatók alatt.",
    mThinking: "Gondolkodás",
    mCooldown: "Hűtés (óra)",
    mContextWindow: "Kontextusablak",
    workersOff: "A memória-munkások kikapcsolva — a tömörítés tovább fut.",
    noActivity: "Még nincs memóriatevékenység.",
    stateRecorded: "rögzítve",
    stateNotDue: "esedékes nem",
    stateEmpty: "üres",
    stateSkipped: "kipihentetve",
    stateInitial: "kezdeti",
    stateError: "hiba",
    stateOther: "egyéb állapot",
    stateUnknown: "nincs kurzor",
    workerStateA11y: "{worker}: {state}",
    workerCoolingA11y: "{worker}: {model} tartalékmodellen, kb. {minutes} perc hűtés",
    lagLabel: "Lemaradás",
    lagA11y: "kurzor {lag} bejegyzéses lemaradásban",
    lagStale: "A kurzor az előzmények előtt jár",
    lagStaleA11y: "a kurzor a rögzített előzmények előtt jár",
    proximityLabel: "Tömörítés közelsége ≈",
    proximityA11y: "tömörítés közelsége, közelítő",
    proximityExplain:
      "Közelítő: a blackhole más mennyiséget számol. Ez a becslés a dashboard saját tokenszámítását használja — a kettő nem váltható át.",
    pendingAdvisory: "{count} tétel vár —— /blackhole paranccsal üríthető.",
    cooldownAdvisory: "{model} hűtésben —— kb. {minutes} perc múlva áll vissza.",
    detailButton: "Részletek",
    backToChat: "← Vissza a beszélgetéshez",
    detailTitle: "Memória-folyamat részletei",
    workerColumn: "Munkás",
    cursorColumn: "Kurzor",
    resolvedColumn: "Feloldott modell",
    cursorsSource: "Munkás kurzorok — forrás: pi-blackhole/<munkamenet id>-pending.json",
    cooldownReason: "Hűtésben: {reason}",
    cooldownSource:
      "Hűtéses tartalékok és okok — forrás: pi-blackhole/pi-blackhole-cooldown.json (az elsődleges modellek a konfigból)",
    proximitySource:
      "A dashboard saját tokenszámításából becsülve a compactAfterTokens ellen. A blackhole számlálója más mennyiséget mér és nem perzisztált —— a kettő nem váltható át.",
    transcriptNote:
      "A megfigyelési és reflexiós számlálók csak futó munkamenetben léteznek — a megfigyelések és reflexiók a munkamenet átiratában jelennek meg.",
    pipelineLoadError: "A folyamat állapota nem tölthető be.",
    omLabelRecorded: "Rögzített megfigyelések",
    omLabelReflections: "Rögzített reflexiók",
    omLabelDropped: "Eldobott megfigyelések",
    omExpand: "Bejegyzés kibontása",
    omCollapse: "Bejegyzés összecsukása",
    omLoading: "Betöltés…",
    omNoRecords: "Nincsenek rekordok",
  },
};
