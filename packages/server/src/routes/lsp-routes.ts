/**
 * Language-server REST surface: `GET /api/lsp/status` reports whether a
 * language's server is installed and whether the workspace is trusted;
 * `PUT /api/lsp/trust` sets the workspace trust flag. Both gate on the
 * session-cwd allowlist, the same as `/api/grep`.
 */
import type { ApiResponse } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import type { FastifyInstance } from "fastify";
import { isLspLanguage, resolveLspCommand } from "../lsp/lsp-languages.js";
import type { LspTrustStore } from "../lsp/lsp-trust.js";
import type { SessionManager } from "../session/memory-session-manager.js";
import type { NetworkGuard } from "./route-deps.js";

export function registerLspRoutes(
  fastify: FastifyInstance,
  deps: { sessionManager: SessionManager; networkGuard: NetworkGuard; trust: LspTrustStore },
) {
  const { sessionManager, networkGuard, trust } = deps;
  const isKnownCwd = (cwd: string) => sessionManager.listAll().some((s) => s.cwd === cwd);

  fastify.get<{ Querystring: { cwd?: string; language?: string } }>(
    "/api/lsp/status",
    { preHandler: networkGuard },
    async (request, reply) => {
      const { cwd, language } = request.query;
      if (!cwd || !language || !isLspLanguage(language)) {
        reply.code(400);
        return { success: false, error: "cwd and a supported language are required" } satisfies ApiResponse;
      }
      if (!isKnownCwd(cwd)) {
        reply.code(403);
        return { success: false, error: "unknown session path" } satisfies ApiResponse;
      }
      return {
        success: true,
        data: { available: resolveLspCommand(language) !== null, trusted: trust.isTrusted(cwd) },
      } satisfies ApiResponse;
    },
  );

  fastify.put<{ Body: { cwd?: string; trusted?: boolean } }>(
    "/api/lsp/trust",
    { preHandler: networkGuard },
    async (request, reply) => {
      const { cwd, trusted } = request.body ?? {};
      if (!cwd || typeof trusted !== "boolean") {
        reply.code(400);
        return { success: false, error: "cwd and boolean trusted are required" } satisfies ApiResponse;
      }
      if (!isKnownCwd(cwd)) {
        reply.code(403);
        return { success: false, error: "unknown session path" } satisfies ApiResponse;
      }
      trust.setTrusted(cwd, trusted);
      return { success: true, data: { trusted: trust.isTrusted(cwd) } } satisfies ApiResponse;
    },
  );
}
