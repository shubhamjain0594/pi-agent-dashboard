/**
 * Browser plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared
 * as `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest) and the
 * shell merges it under `plugin.browser.*`. Component code resolves keys via
 * the scoped `useT()` hook, which auto-prefixes `plugin.browser.`.
 *
 * hu is the only non-English catalog. {var} placeholders are
 * preserved verbatim so `t(key, vars)` can interpolate.
 *
 * See change: add-browser-relay (task 4.4).
 */
export const catalog = {
  hu: {
    loading: "Betöltés…",
    settingsError: "A böngésző-közvetítő beállításai nem érhetők el.",
    settingsIntro: "A bejelentkezett Chrome közvetítése egy pi munkamenetbe a Playwright bővítményen keresztül.",
    enabledLabel: "Engedélyezve",
    cannotOpenChrome: "Ez a gép nem tudja automatikusan megnyitni a Chrome-ot. Indítsa el a Chrome-ot a közvetítő bővítménnyel, majd csatlakozzon.",
    profilesWarning: "A Chrome profilok nem olvashatók ({path}); alapértelmezett profil megjelenítése.",
    noProfiles: "Nem található Chrome profil.",
    installed: "Bővítmény telepítve",
    notInstalled: "Bővítmény nincs telepítve",
    tokenSet: "Token beállítva",
    tokenMissing: "Nincs token",
    notConnected: "Nincs csatlakozva",
    connectedTabs: "Csatlakozva · {n} lap",
    connect: "Csatlakozás",
    disconnect: "Leválasztás",
    relayDisabled: "Böngésző-közvetítő letiltva",
    installExtension: "A Playwright bővítmény telepítése",
    tokenPlaceholder: "Párosítási token beillesztése",
    saveToken: "Token mentése",
    zeroDialogLabel: "Nulla párbeszéd (Chrome engedélykérés kihagyása)",
    zeroDialogHelp: "Érvényes tokent igényel. A nem egyező token, az elutasítás és a válasz hiánya egyaránt 60 másodperces időtúllépésként jelenik meg.",
    allowedDomainsLabel: "Engedélyezett domainek",
    allowedDomainsHelp: "Csak a Page.navigate és a Target.createTarget hívásokat őrzi — más hálózati forgalmat nem.",
    auditTitle: "Napló",
    auditEmpty: "Nincs naplóbejegyzés.",
    instanceTabs: "{n} lap",
    close: "Bezárás",
    waitingFrame: "Várakozás képkockára…",
    noFramesOverlay: "Nincs újrarajzolás — a lap lehet tétlen vagy háttérben",
    bringToFront: "Előtérbe",
    devtoolsOverlay: "A DevTools nyitva van ezen a lapon — zárja be a folytatáshoz",
    relayBadge: "{n} böngészőlap",
    noSessionOverlay: "A lap még nem megtekinthető — az ügynök még nem csatlakozott hozzá (a bővítményoldalak nem tekinthetők meg)",
    untitledTab: "Névtelen lap",
    frameAlt: "Élő böngésző képkocka",
    paneTabGone: "Ez a böngészőlap már nem érhető el",
    paneUrl: "Oldal címe",
    inputOn: "Bevitel: be",
    inputOff: "Bevitel: ki",
    fit: "Illesztés",
    oneToOne: "1:1",
    done: "Kész ✓",
    textBridge: "Írás az oldalra",
    clientScreencast: "Az ügynök rögzíti ezt a lapot — nincs élő nézet",
    tabFallback: "Böngészőlap",
    stateLive: "élő",
    stateIdle: "tétlen",
    stateDetached: "leválasztva",
    stateAgent: "az ügynök rögzít",
    badgeMenu: "Böngészőlapok megnyitása a panelben",
    openInPane: "Megnyitás a panelben",
    openAllInPane: "Összes megnyitása a panelben",
  },
} as const;
