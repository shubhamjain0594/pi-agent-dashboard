/**
 * context-mode-settings plugin i18n catalog — UNPREFIXED leaf keys, merged by the
 * shell under `plugin.context-mode-settings.*`. `hu` is the only non-English catalog (scripts/i18n-parity). English lives at call sites as the
 * `t(key, vars, fallback)` fallback. Field labels/help are presentation data in
 * the descriptor table, not i18n keys.
 *
 * See change: add-context-mode-settings-plugin.
 */
export const catalog = {
  hu: {
    loadError: "A beállítások betöltése sikertelen: {error}",
    loading: "Betöltés…",
    intro: "A",
    introTail: "bővítmény finomhangolása. Az alapértelmezetten hagyott mezők a context-mode beépített értékét használják.",
    file: "Fájl:",
    exists: "létezik",
    notCreated: "még nincs létrehozva",
    newSessionsNotice: "A módosítások csak az újonnan indított munkamenetekre vonatkoznak; a futók megtartják a jelenlegi beállításaikat.",
    precedenceNotice: "A munkamenet környezetében már exportált változó elsőbbséget élvez ezekkel a beállításokkal szemben (kivéve a csak a tmux szerver globális környezetében lévő értéket).",
    storageNotice: "A tárolási beállítások csak a dashboard által indított munkamenetekre vonatkoznak. Terminálból indított pi esetén exportálja a változót a shellben.",
    fields: "mező",
    noChanges: "Nincs változás",
    unsaved: "Nem mentett módosítások",
    unsavedOne: "1 nem mentett módosítás",
    unsavedMany: "{count} nem mentett módosítás",
    on: "Be",
    off: "Ki",
    viewRawJson: "Nyers JSON megtekintése",
    defaultBadge: "alapért.",
    reset: "Visszaállítás",
    fixInvalidFields: "Mentés előtt javítsa az érvénytelen mezőket.",
    group_storage: "Tárolás",
    group_search: "Keresés szabályozása",
    group_locale: "Területi beállítások",
    group_stats: "Statisztika",
    group_network: "Hálózat",
    err_expected_boolean: "Logikai érték szükséges",
    err_expected_positive_number: "Pozitív szám szükséges",
    err_expected_positive_integer: "Pozitív egész szám szükséges",
    err_expected_string: "Nem üres szöveg szükséges",
    err_expected_path: "Útvonal szükséges",
    err_expected_absolute_path: "Abszolút útvonal vagy ~-szal kezdődő szükséges",
    err_invalid_locale: "Érvénytelen nyelvi címke",
    err_invalid_time_zone: "Érvénytelen IANA időzóna",
  },
};
