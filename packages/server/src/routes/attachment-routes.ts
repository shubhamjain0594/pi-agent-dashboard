/**
 * Attachment-original REST route (localhost-only):
 * `GET /api/sessions/:sessionId/attachments/:attachmentId`.
 *
 * Serves full-resolution originals for zoom, or a bounded fitted derivative
 * with `?display=1`. Display refs recover from resident events first, then
 * fit this session's original through the shared worker pool. No image
 * decoding/encoding or derivative cache lives in this route.
 *
 * Security gates, in order — each one closes a distinct attack:
 *  1. `networkGuard` — same authorisation as every other session-data route.
 *  2. Session must exist AND be known to this dashboard, else 404.
 *  3. `attachmentId` must be a 64-char lowercase-hex digest, else 400. Nothing
 *     from the request ever becomes a path component, so traversal is
 *     structurally impossible (X3).
 *  4. Recovery is scoped to THAT session's transcript, so a valid digest from
 *     another session is simply not found (X2).
 *  5. Only allow-listed raster types are served, always with `nosniff` and a
 *     `default-src 'none'; sandbox` CSP, so the response can never be
 *     interpreted as active content (E14/E15). Deliberately NO
 *     `Content-Disposition: attachment`: the bytes are rendered inline by the
 *     zoom overlay, and forcing a download would break that while adding
 *     nothing — the allow-list plus `nosniff` plus the sandbox CSP already
 *     stop the response being executed.
 *
 * See change: fit-attachments-for-display (task 5.7, D8).
 */
import type { ApiResponse } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import type { FastifyInstance } from "fastify";
import { attachmentResolutions } from "../attachments/attachment-snapshot.js";
import { DISPLAY_MAX_BYTES } from "../attachments/display-fit.js";
import type { FitWorkerPool } from "../attachments/fit-worker-pool.js";
import { normalizeImageMime } from "../attachments/image-mime.js";
import { findOriginalInTranscript, isAllowedImageMime, isValidAttachmentId, type RecoveredOriginal } from "../attachments/original-store.js";
import type { EventStore } from "../persistence/memory-event-store.js";
import type { SessionManager } from "../session/memory-session-manager.js";
import type { NetworkGuard } from "./route-deps.js";

function displayBytes(data: string, mimeType: string) {
  // DISPLAY_MAX_BYTES budgets base64, not decoded raster size. Validate before
  // allocating the response buffer; Buffer.from alone tolerates invalid input.
  if (!data || data.length > DISPLAY_MAX_BYTES || !isAllowedImageMime(mimeType) ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.toString("base64").replace(/=+$/, "") !== data.replace(/=+$/, "")) return null;
  return { bytes, mimeType: normalizeImageMime(mimeType) };
}

interface DisplayDeps {
  eventStore?: Pick<EventStore, "getEvents">;
  fitWorkerPool?: FitWorkerPool;
}

function residentDisplay(sessionId: string, attachmentId: string, eventStore: DisplayDeps["eventStore"]) {
  const rows = eventStore?.getEvents(sessionId, 1) ?? [];
  for (let i = rows.length - 1; i >= 0; i--) {
    for (const resolution of attachmentResolutions(rows[i].event)) {
      if (resolution.attachmentId !== attachmentId) continue;
      // Empty ready refs are not derivatives. Seek an older resident payload
      // before recovering from transcript. An explicit failure is authoritative.
      if (resolution.state === "ready" && !resolution.data) continue;
      return resolution.state === "ready" ? displayBytes(resolution.data, resolution.mimeType ?? "") : null;
    }
  }
  return undefined;
}

type DisplayResult = { status: 200; image: RecoveredOriginal } | { status: 404 | 503; image?: never };

async function resolveDisplay(sessionId: string, sessionFile: string | undefined, attachmentId: string, deps: DisplayDeps): Promise<DisplayResult> {
  const resident = residentDisplay(sessionId, attachmentId, deps.eventStore);
  if (resident !== undefined) return resident ? { status: 200, image: resident } : { status: 404 };
  if (!sessionFile) return { status: 404 };
  if (!deps.fitWorkerPool) return { status: 503 };
  const source = await findOriginalInTranscript(sessionFile, attachmentId);
  if (!source) return { status: 404 };
  try {
    const fitted = await deps.fitWorkerPool.fit({ blocks: [
      { blockIndex: 0, data: source.bytes.toString("base64"), mimeType: source.mimeType },
    ] });
    const block = fitted.results.find((result) => result.blockIndex === 0);
    const image = block && !block.failed ? displayBytes(block.data, block.mimeType) : null;
    return image ? { status: 200, image } : { status: 404 };
  } catch {
    return { status: 503 };
  }
}

export function registerAttachmentRoutes(
  fastify: FastifyInstance,
  deps: {
    sessionManager: SessionManager;
    networkGuard: NetworkGuard;
    eventStore?: Pick<EventStore, "getEvents">;
    fitWorkerPool?: FitWorkerPool;
  },
) {
  const { sessionManager, networkGuard } = deps;
  // Bound admission BEFORE transcript scanning/worker submission. Concurrent
  // requests for the same session/image share one job; completed bytes are not
  // cached here. Resident derivatives need neither a slot nor a transcript.
  const displayJobs = new Map<string, Promise<DisplayResult>>();
  const maxDisplayJobs = 4;
  const getDisplay = (sessionId: string, sessionFile: string | undefined, attachmentId: string): Promise<DisplayResult> => {
    const resident = residentDisplay(sessionId, attachmentId, deps.eventStore);
    if (resident !== undefined) return Promise.resolve(resident ? { status: 200, image: resident } : { status: 404 });
    const key = JSON.stringify([sessionId, attachmentId]);
    const running = displayJobs.get(key);
    if (running) return running;
    if (displayJobs.size >= maxDisplayJobs) return Promise.resolve({ status: 503 });
    const job = Promise.resolve().then(() => resolveDisplay(sessionId, sessionFile, attachmentId, deps))
      .finally(() => displayJobs.delete(key));
    displayJobs.set(key, job);
    return job;
  };

  fastify.get<{ Params: { sessionId: string; attachmentId: string }; Querystring: { display?: string } }>(
    "/api/sessions/:sessionId/attachments/:attachmentId",
    { preHandler: networkGuard },
    async (request, reply) => {
      const { sessionId, attachmentId } = request.params;
      const displayRequested = request.query.display === "1";
      if (displayRequested) reply.header("Cache-Control", "no-store, private");

      const session = sessionManager.get(sessionId);
      if (!session || (!displayRequested && !session.sessionFile)) {
        // Unknown session, or one with no transcript to recover from. Same
        // 404 either way — do not distinguish, so the endpoint cannot be used
        // to probe which session ids exist. This gate precedes the shape check
        // deliberately: answering 400 for a malformed id on a NON-existent
        // session would make the status code reveal which sessions are real.
        reply.code(404);
        return { success: false, error: "not found" } satisfies ApiResponse;
      }

      // Shape-check before the recovery path: a malformed id is a client error
      // and must never reach transcript scanning.
      if (!isValidAttachmentId(attachmentId)) {
        reply.code(400);
        return { success: false, error: "invalid attachment id" } satisfies ApiResponse;
      }

      let original: RecoveredOriginal | null | undefined;
      if (displayRequested) {
        const display = await getDisplay(sessionId, session.sessionFile, attachmentId);
        if (display.status !== 200) {
          reply.code(display.status);
          return { success: false, error: display.status === 503 ? "display fitting unavailable" : "display attachment unavailable" } satisfies ApiResponse;
        }
        original = display.image;
      } else {
        original = await findOriginalInTranscript(session.sessionFile!, attachmentId);
      }
      if (!original) {
        reply.code(404);
        return { success: false, error: "not found" } satisfies ApiResponse;
      }

      reply.header("Content-Type", original.mimeType);
      // Belt-and-braces against content sniffing and inline execution.
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("Content-Security-Policy", "default-src 'none'; sandbox");
      // The bytes are content-addressed and therefore immutable, but they are
      // also PRIVATE user screenshots behind an auth check. Caching them for a
      // year wrote them to browser/proxy disk caches, where they outlive the
      // session and the credential that unlocked them (CWE-524). Immutability
      // is not a reason to persist someone's screen contents; re-fetch instead.
      reply.header("Cache-Control", "no-store, private");
      reply.header("Content-Length", String(original.bytes.length));
      return reply.send(original.bytes);
    },
  );
}
