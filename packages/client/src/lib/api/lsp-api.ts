/**
 * Client helpers for the language-server REST surface: `GET /api/lsp/status`
 * (installed + trusted) and `PUT /api/lsp/trust` (set workspace trust).
 */
import { fetchWithoutGrantPrompt } from "../access-grants/grant-channel.js";
import { getApiBase } from "./api-context.js";

export type LspClientLanguage = "typescript" | "python";

export interface LspStatus {
  available: boolean;
  trusted: boolean;
}

/**
 * Opted out of the access-grant prompt: a preview surface must never raise an
 * access dialog from a status probe or a trust toggle (same rule as MonacoBuffer).
 */
async function lspJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetchWithoutGrantPrompt(url, init);
  return res.json();
}

export async function fetchLspStatus(cwd: string, language: LspClientLanguage): Promise<LspStatus | null> {
  try {
    const params = new URLSearchParams({ cwd, language });
    const json = await lspJson(`${getApiBase()}/api/lsp/status?${params.toString()}`);
    return json.success ? (json.data as LspStatus) : null;
  } catch {
    return null;
  }
}

export async function setLspTrust(cwd: string, trusted: boolean): Promise<boolean> {
  try {
    const json = await lspJson(`${getApiBase()}/api/lsp/trust`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd, trusted }),
    });
    return json.success === true && json.data?.trusted === trusted;
  } catch {
    return false;
  }
}
