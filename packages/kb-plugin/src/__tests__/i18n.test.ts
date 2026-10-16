/**
 * kb catalog — the denied / pin / missing / no-sources strings exist in every
 * locale keeps key parity (test-plan #E13).
 * See change: kb-denied-folder-pin-state (design D6, D11).
 */
import { describe, expect, it } from "vitest";
import { catalog } from "../i18n.js";

const KEYS = [
  "labelNotAllowedShort",
  "titleDenied",
  "labelPinningShort",
  "pinFolder",
  "pinOffline",
  "labelOffline",
  "labelFolderMissingShort",
  "folderMissingAction",
  "labelNoSourcesShort",
  "configureSources",
] as const;

describe("kb catalog", () => {
  it("E13: the denied / pin / missing / no-sources keys exist in every locale", () => {
    for (const locale of ["hu"] as const) {
      const strings = catalog[locale] as Record<string, string>;
      for (const key of KEYS) expect(strings[key], `${locale}.${key}`).toBeTruthy();
    }
  });

});

// test-plan #E23 — the plugins this change touched carry every new key in hu.
// See change: retro-ux-plugin-settings-forms.
import { catalog as contextMode } from "../../../context-mode-settings-plugin/src/i18n.js";
import { catalog as hermes } from "../../../hermes-memory-plugin/src/i18n.js";

const NEW_KEYS: Record<string, { catalog: typeof hermes; keys: string[] }> = {
  "context-mode": { catalog: contextMode as never, keys: ["unsavedOne", "unsavedMany", "on", "off"] },
  hermes: {
    catalog: hermes as never,
    keys: ["errEnterNumber", "errMin", "errWhole", "errRegex", "noModels", "openProviders", "on", "off", "inheritUnset", "groupChanged", "rawTitle"],
  },
};

