/**
 * Roles plugin i18n catalog — UNPREFIXED leaf keys.
 *
 * The generated plugin registry imports the `catalog` named export (declared
 * as `i18nCatalog` in package.json's `pi-dashboard-plugin` manifest) and the
 * shell merges it under `plugin.roles.*`. Component code resolves keys via the
 * scoped `useT()` hook, which auto-prefixes `plugin.roles.`.
 *
 * hu is the only non-English catalog. {var} placeholders are
 * preserved verbatim so `t(key, vars)` can interpolate.
 *
 * See change: make-all-ui-text-i18n.
 */
export const catalog = {
  hu: {
    noModelAssigned: "Nincs modell hozzárendelve",
    roleRefThinking: "gondolkodás",
    statusDetached: "Leválasztva",
    statusDangling: "A szerep nincs hozzárendelve, az utolsó modell marad",
    levelDropped: "A(z) {level} gondolkodási szintet a(z) {model} nem támogatja, ezért a szint elhagyva.",
    rolesHeading: "Szerepek",
    rolesSubheading: "globális szerep → modell hozzárendelések",
    setupBanner:
      "Még nincs beállított szerep — állítsd be most úgy, hogy alább modellt rendelsz egy szerephez.",
    addModel: "+ Modell hozzáadása",
    addCustomRole: "+ Egyéni szerep hozzáadása",
    customRoleNamePlaceholder: "egyéni-szerep-név…",
    cancelAddCustomRole: "Egyéni szerep hozzáadásának megszakítása",
    pickModelForRole: "Válassz modellt ehhez a szerephez",
    setModelForRole: "Állíts be modellt a(z) @{role} szerephez",
    unsaved: "Nincs mentve",
    removeCustomRoleLabel: "@{role} egyéni szerep eltávolítása",
    removeCustomRoleConfirm:
      "Eltávolítod a(z) @{role} egyéni szerepet? Ez minden előbeállításból törli.",
    noLiveSession: "Nincs élő pi munkamenet a szerepváltozások alkalmazásához",
    discardUnsavedRoleChanges: "Elveted a nem mentett szerepváltozásokat?",
    saveCurrentAsPreset: "+ Jelenlegi mentése előbeállításként",
    presetNamePlaceholder: "előbeállítás neve…",
    unsavedEditsSavedFirst: "A nem mentett szerkesztések előbb mentésre kerülnek.",
    deletePresetLabel: "{name} előbeállítás törlése",
    deletePresetTitle: '"{name}" előbeállítás törlése',
    builtinGroup: "Beépített",
    customGroup: "Egyéni",
    assignModelTo: "Modell hozzárendelése ehhez:",
  },
};
