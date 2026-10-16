import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme, CSS_VAR_KEYS } from "../../lib/theme/themes.js";
import { STORAGE_KEY, THEME_NAME_KEY, useTheme } from "../useTheme.js";

let meta: HTMLMetaElement;
let style: HTMLStyleElement;

function resetTheme() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(THEME_NAME_KEY);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("color-scheme");
  for (const key of CSS_VAR_KEYS) document.documentElement.style.removeProperty(key);
}

beforeEach(() => {
  // Parallel workers share Pi's Node localStorage file; do not race the
  // existing useTheme suite's saved preferences while testing chrome metadata.
  const saved = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
    removeItem: (key: string) => { saved.delete(key); },
  });
  resetTheme();
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches: media === "(prefers-color-scheme: dark)", media,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = "#3b82f6";
  style = document.createElement("style");
  const base = getTheme("base")!;
  style.textContent = `:root { --bg-secondary: ${base.dark["--bg-secondary"]}; }
    :root[data-theme="light"] { --bg-secondary: ${base.light["--bg-secondary"]}; }`;
  document.head.append(meta, style);
});

afterEach(() => {
  meta.remove();
  style.remove();
  resetTheme();
  vi.unstubAllGlobals();
});

describe("installed-app browser chrome", () => {
  it("replaces blue with the active dashboard surface on mount", () => {
    renderHook(() => useTheme());
    expect(meta.content).toBe(getTheme("base")!.dark["--bg-secondary"]);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("honors a saved light preference and follows explicit mode changes", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(meta.content).toBe(getTheme("base")!.light["--bg-secondary"]);
    expect(document.documentElement.style.colorScheme).toBe("light");
    act(() => result.current.setPreference("dark"));
    expect(meta.content).toBe(getTheme("base")!.dark["--bg-secondary"]);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("follows palette changes, palette modes and a return to base", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setThemeName("nord"));
    expect(meta.content).toBe(getTheme("nord")!.dark["--bg-secondary"]);
    act(() => result.current.setPreference("light"));
    expect(meta.content).toBe(getTheme("nord")!.light["--bg-secondary"]);
    act(() => result.current.setThemeName("base"));
    expect(meta.content).toBe(getTheme("base")!.light["--bg-secondary"]);
  });

  it("follows an OS theme change when using the system preference", () => {
    let dark = true;
    let notify: (() => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation((media: string) => ({
      get matches() { return dark; }, media,
      addEventListener: vi.fn((_event, handler) => { notify = handler; }),
      removeEventListener: vi.fn(),
    }));
    renderHook(() => useTheme());
    act(() => { dark = false; notify!(); });
    expect(meta.content).toBe(getTheme("base")!.light["--bg-secondary"]);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("ships neutral install/startup colors instead of the blue accent", () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../../../../public/manifest.json"), "utf8"));
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    const surface = getTheme("base")!.dark["--bg-secondary"];
    expect(manifest.theme_color).toBe(surface);
    expect(manifest.background_color).toBe(surface);
    expect(manifest.display).toBe("standalone");
    expect(manifest.display_override).toEqual(["window-controls-overlay"]);
    const chrome = readFileSync(resolve(__dirname, "../../styles/workbench.css"), "utf8");
    expect(chrome).toContain("@media (display-mode: window-controls-overlay)");
    expect(chrome).toContain("app-region: drag");
    expect(html).toContain(`<meta name="theme-color" content="${surface}"`);
  });
});
