/**
 * Hermes-memory plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared
 * as `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest) and the
 * shell merges it under `plugin.hermes-memory.*`. Component code resolves keys
 * via the scoped `useT()` hook, which auto-prefixes `plugin.hermes-memory.`.
 *
 * `hu` is the only non-English catalog.
 * English lives at the call sites as the `t(key, vars, fallback)` fallback.
 * Field labels/help are presentation DATA (field-groups.ts), not i18n keys.
 * {var} placeholders are preserved verbatim so `t(key, vars)` can interpolate.
 *
 * See change: add-hermes-memory-settings-plugin.
 */
export const catalog = {
  hu: {
    loadError: "A konfiguráció betöltése sikertelen: {error}",
    loading: "Betöltés…",
    intro: "A",
    introTail: "bővítmény konfigurációja. Az alapértelmezetten hagyott mezők a bővítmény beépített értékét követik.",
    file: "Fájl:",
    exists: "létezik",
    notCreated: "még nincs létrehozva",
    newSessionsNotice:
      "A módosítások az újonnan indított munkamenetekre vonatkoznak. A Hermes a konfigurációt a bővítmény betöltésekor egyszer olvassa be, ezért a futó munkamenetek újraindításig megtartják a jelenlegi beállításokat.",
    fields: "mező",
    nChanged: "{count} mező módosítva · még nincs mentve",
    noChanges: "Nincs változás",
    viewRawJson: "Nyers JSON megtekintése",
    revert: "Visszaállítás",
    saving: "Mentés…",
    save: "Mentés",
    resolved: "feloldott",
    close: "Bezárás",
    defaultBadge: "alapért.",
    reset: "Visszaállítás",
    modelSelectorUnavailable: "A modellválasztó nem érhető el",
    inheritSessionModel: "Munkamenet modelljének öröklése",
    errEnterNumber: "Adjon meg egy számot",
    errMin: "Legalább {min} szükséges",
    errWhole: "Egész szám szükséges",
    errRegex: "Érvénytelen reguláris kifejezés: {line}",
    noModels: "Nincs elérhető modell. Adjon hozzá szolgáltatót, majd válasszon modellt.",
    openProviders: "Szolgáltatók megnyitása",
    on: "Be",
    off: "Ki",
    inheritUnset: "(öröklés / nincs beállítva)",
    groupChanged: "módosítva",
    rawTitle: "Feloldott konfiguráció",
  },
};
