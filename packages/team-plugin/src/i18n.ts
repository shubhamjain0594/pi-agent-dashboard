/**
 * Team plugin i18n catalog — UNPREFIXED leaf keys (the shell merges them under
 * `plugin.team.*`; component code resolves via the scoped `useT()`). hu is the only non-English catalog; English is the call-site fallback.
 * See change: add-team-plugin.
 */
export const catalog = {
  hu: {
    rowLabel: "Csapat",
    rowCount: "{agents} ügynök · {active} aktív",
    rowTitle: "A mappa AI csapatának megnyitása",
    openTeam: "Csapat",
    teamSettings: "Csapat beállításai…",
    disableTeam: "Csapat kikapcsolása",
    enableTeam: "Csapat bekapcsolása ehhez a mappához",
    dlgEnableTitle: "Csapat bekapcsolása: {name}",
    dlgSettingsTitle: "Csapat beállításai: {name}",
    projName: "Projekt neve",
    projNameHint: "A felhasználók ezt látják a projektválasztóban.",
    who: "Kik használhatják",
    everyone: "Mindenki, aki be van jelentkezve",
    selected: "Kiválasztott felhasználók",
    usersHint: "Azok szerepelnek itt, akik már megnyitották a csapat alkalmazást.",
    ctxFiles: "A mappa AGENTS.md és CLAUDE.md fájlját is megkapják az ügynökök",
    ctxHint: "Fájlonként legfeljebb 64 KiB, nem megbízható bemenetként kezelve.",
    ok: "Bekapcsolás",
    save: "Mentés",
    cancel: "Mégse",
    errName: "Adj nevet a projektnek.",
    errUsers: "Válassz legalább egy felhasználót, vagy engedd mindenkinek.",
    errSave: "A mentés nem sikerült. Próbáld újra.",
    disTitle: "Csapat kikapcsolása: {name}?",
    disBody: "A beszélgetések és a fájlok megmaradnak; ha újra bekapcsolod, visszajönnek.",
    disOk: "Kikapcsolás",
  },
} as const;
