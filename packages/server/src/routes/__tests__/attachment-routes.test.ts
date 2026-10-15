import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, describe, expect, it, vi } from "vitest";
import { DISPLAY_MAX_BYTES } from "../../attachments/display-fit.js";
import type { FitWorkerPool } from "../../attachments/fit-worker-pool.js";
import { createMemoryEventStore } from "../../persistence/memory-event-store.js";
import type { SessionManager } from "../../session/memory-session-manager.js";
import { registerAttachmentRoutes } from "../attachment-routes.js";

const cleanup: string[] = [];
afterAll(() => { for (const r of cleanup) rmSync(r, { recursive: true, force: true }); });

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const PNG_B64 = Buffer.from("\x89PNG\r\n\x1a\nORIGINALBYTES").toString("base64");

function transcriptWith(images: Array<{ data: string; mimeType: string }>): string {
  const root = mkdtempSync(join(tmpdir(), "att-route-"));
  cleanup.push(root);
  const file = join(root, "session.jsonl");
  writeFileSync(
    file,
    JSON.stringify({
      type: "message",
      message: {
        role: "user",
        content: [{ type: "text", text: "hi" }, ...images.map((i) => ({ type: "image", ...i }))],
      },
    }) + "\n",
  );
  return file;
}

/** `guard` lets a test simulate an unauthorised caller (X1). */
function buildApp(
  sessions: Record<string, { sessionFile?: string }>,
  guard: (req: any, reply: any) => Promise<void> = async () => {},
  displayDeps: Pick<Parameters<typeof registerAttachmentRoutes>[1], "eventStore" | "fitWorkerPool"> = {},
): FastifyInstance {
  const app = Fastify();
  const sessionManager = {
    get: (id: string) => sessions[id],
  } as unknown as SessionManager;
  registerAttachmentRoutes(app, { sessionManager, networkGuard: guard, ...displayDeps });
  return app;
}

describe("GET /api/sessions/:sessionId/attachments/:attachmentId", () => {
  it("serves the original bytes with an allow-listed content type", async () => {
    const file = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const app = buildApp({ s1: { sessionFile: file } });
    const res = await app.inject({ url: `/api/sessions/s1/attachments/${sha(PNG_B64)}` });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    // F5: byte-identical to what the user attached.
    expect(res.rawPayload.toString("base64")).toBe(PNG_B64);
    await app.close();
  });

  it("E15: hardening headers make the response non-executable", async () => {
    const file = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const app = buildApp({ s1: { sessionFile: file } });
    const res = await app.inject({ url: `/api/sessions/s1/attachments/${sha(PNG_B64)}` });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(String(res.headers["content-security-policy"])).toContain("default-src 'none'");
    await app.close();
  });

  it("CWE-524: user image bytes are never written to a browser/proxy cache", async () => {
    // This endpoint is authenticated and serves private user screenshots.
    // A long-lived `max-age` persisted those bytes to disk, readable after
    // the session ended and by anyone with access to the cache.
    const file = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const app = buildApp({ s1: { sessionFile: file } });
    const res = await app.inject({ url: `/api/sessions/s1/attachments/${sha(PNG_B64)}` });

    const cc = String(res.headers["cache-control"]);
    expect(cc).toContain("no-store");
    // `private` is load-bearing too: without it a SHARED proxy may cache the
    // response for other users even while the browser honours no-store.
    expect(cc).toContain("private");
    expect(cc).not.toMatch(/max-age=(?!0)\d+/);
    expect(cc).not.toContain("immutable");
    await app.close();
  });

  it("X1: an unauthorised caller is refused and no bytes are returned", async () => {
    const file = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const app = buildApp({ s1: { sessionFile: file } }, async (_req, reply) => {
      reply.code(403).send({ success: false, error: "forbidden" });
    });
    const res = await app.inject({ url: `/api/sessions/s1/attachments/${sha(PNG_B64)}` });

    expect(res.statusCode).toBe(403);
    expect(res.rawPayload.toString("base64")).not.toBe(PNG_B64);
    await app.close();
  });

  it("X2: a valid hash from ANOTHER session is not served", async () => {
    const mine = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const theirsData = Buffer.from("SOMEONE-ELSES-IMAGE").toString("base64");
    const theirs = transcriptWith([{ data: theirsData, mimeType: "image/png" }]);
    const app = buildApp({ s1: { sessionFile: mine }, s2: { sessionFile: theirs } });

    // Ask session s1 for a digest that only exists in s2.
    const res = await app.inject({ url: `/api/sessions/s1/attachments/${sha(theirsData)}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("X3: traversal and non-hex ids are rejected as 400 before any lookup", async () => {
    const file = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const app = buildApp({ s1: { sessionFile: file } });
    // Assert 400 specifically for route-matched malformed ids: accepting 404 too
    // would let a regression that bypasses isValidAttachmentId slip through.
    for (const bad of ["not-hex", "A".repeat(64), "a".repeat(63), `${"a".repeat(64)}x`]) {
      const res = await app.inject({ url: `/api/sessions/s1/attachments/${encodeURIComponent(bad)}` });
      expect(res.statusCode, `id ${bad}`).toBe(400);
      expect(res.rawPayload.toString("base64")).not.toBe(PNG_B64);
    }
    await app.close();
  });

  it("X6: an unknown session yields a clean 404, not a crash", async () => {
    const app = buildApp({});
    const res = await app.inject({ url: `/api/sessions/ghost/attachments/${sha(PNG_B64)}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("X6c: an unknown session yields 404 whatever the id shape, leaking nothing", async () => {
    // Gate order is session-then-shape: a malformed id must NOT earn a 400 on a
    // session that does not exist, or the status code distinguishes "real
    // session, bad id" from "no such session" and turns the endpoint into a
    // session-id oracle.
    const app = buildApp({});
    for (const bad of ["not-hex", "A".repeat(64), `${"a".repeat(64)}x`]) {
      const res = await app.inject({ url: `/api/sessions/ghost/attachments/${encodeURIComponent(bad)}` });
      expect(res.statusCode, `id ${bad}`).toBe(404);
    }
    await app.close();
  });

  it("X6b: a session whose transcript file is gone yields a clean 404", async () => {
    const app = buildApp({ s1: { sessionFile: "/tmp/definitely-not-here-9f2b.jsonl" } });
    const res = await app.inject({ url: `/api/sessions/s1/attachments/${sha(PNG_B64)}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("E15: a blob claiming text/html is never served, even on a hash match", async () => {
    const evil = Buffer.from("<script>alert(1)</script>").toString("base64");
    const file = transcriptWith([{ data: evil, mimeType: "text/html" }]);
    const app = buildApp({ s1: { sessionFile: file } });
    const res = await app.inject({ url: `/api/sessions/s1/attachments/${sha(evil)}` });

    expect(res.statusCode).toBe(404);
    expect(String(res.headers["content-type"])).not.toContain("text/html");
    await app.close();
  });
});

describe("attachment display derivative", () => {
  const fittedData = Buffer.from("FITTED-DERIVATIVE").toString("base64");
  const attachmentId = sha(PNG_B64);
  const url = `/api/sessions/s1/attachments/${attachmentId}?display=1`;
  const fittedBlock = { blockIndex: 0, data: fittedData, mimeType: "image/webp", fitted: true, failed: false };

  function poolWith(block = fittedBlock) {
    const fit = vi.fn<FitWorkerPool["fit"]>().mockResolvedValue({ jobId: 1, results: [block] });
    return { fit, dispose: vi.fn(), inFlight: () => 0 } as FitWorkerPool & { fit: typeof fit };
  }

  it("serves a resident derivative for a known session with no transcript path", async () => {
    const eventStore = createMemoryEventStore(() => false);
    eventStore.insertEvent("s1", { eventType: "attachment_fitted", timestamp: 1,
      data: { attachmentId, state: "ready", data: fittedData, mimeType: "image/webp" } });
    const app = buildApp({ s1: {} }, undefined, { eventStore });
    try {
      expect((await app.inject({ url })).rawPayload.toString("base64")).toBe(fittedData);
      expect((await app.inject({ url: url.split("?")[0] })).statusCode).toBe(404);
    } finally { await app.close(); }
  });

  it("bounds misses before scanning and coalesces duplicate display jobs, releasing slots on completion", async () => {
    const sessionFile = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const pending: Array<(value: Awaited<ReturnType<FitWorkerPool["fit"]>>) => void> = [];
    const fit = vi.fn<FitWorkerPool["fit"]>(() => new Promise((resolve) => pending.push(resolve)));
    const fitWorkerPool = { fit, dispose: vi.fn(), inFlight: () => pending.length } as FitWorkerPool;
    const sessions = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`s${i + 1}`, { sessionFile }]));
    const app = buildApp(sessions, undefined, { fitWorkerPool });
    const requests = Array.from({ length: 4 }, (_, i) => app.inject({ url: `/api/sessions/s${i + 1}/attachments/${attachmentId}?display=1` }).then((response) => response));
    try {
      await vi.waitFor(() => expect(fit).toHaveBeenCalledTimes(4));
      const duplicate = app.inject({ url }).then((response) => response);
      const refused = await app.inject({ url: `/api/sessions/s5/attachments/${attachmentId}?display=1` });
      expect(refused.statusCode).toBe(503);
      expect(refused.headers["cache-control"]).toBe("no-store, private");
      expect(fit).toHaveBeenCalledTimes(4);
      pending.forEach((resolve) => resolve({ jobId: 1, results: [fittedBlock] }));
      for (const response of await Promise.all([...requests, duplicate])) expect(response.statusCode).toBe(200);
      fit.mockResolvedValue({ jobId: 2, results: [fittedBlock] });
      expect((await app.inject({ url: `/api/sessions/s5/attachments/${attachmentId}?display=1` })).statusCode).toBe(200);
      expect(fit).toHaveBeenCalledTimes(5);
    } finally {
      pending.forEach((resolve) => resolve({ jobId: 1, results: [fittedBlock] }));
      await Promise.allSettled(requests);
      await app.close();
    }
  });

  it("serves the newest resident fitted payload with private binary headers, skipping empty ready refs", async () => {
    const eventStore = createMemoryEventStore(() => false);
    for (const data of [PNG_B64, fittedData]) {
      eventStore.insertEvent("s1", { eventType: "attachment_fitted", timestamp: 1,
        data: { attachmentId, state: "ready", data, mimeType: "image/webp" } });
    }
    eventStore.insertEvent("s1", { eventType: "message_end", timestamp: 2, data: { message: {
      role: "user", content: [{ type: "image", attachmentId, attachmentState: "ready", data: "", mimeType: "image/webp" }],
    } } });
    const fitWorkerPool = poolWith();
    // No readable original: a 200 must come from THIS session's resident rows.
    const app = buildApp({ s1: { sessionFile: "/tmp/absent-display-original.jsonl" } }, undefined, { eventStore, fitWorkerPool });
    try {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.toString("base64")).toBe(fittedData);
      expect(res.headers["content-type"]).toBe("image/webp");
      expect(res.headers["content-length"]).toBe(String(Buffer.from(fittedData, "base64").length));
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["content-security-policy"]).toBe("default-src 'none'; sandbox");
      expect(res.headers["cache-control"]).toBe("no-store, private");
      expect(fitWorkerPool.fit).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("serves ready message image bytes without requiring a pool or original", async () => {
    const eventStore = createMemoryEventStore(() => false);
    eventStore.insertEvent("s1", { eventType: "message_end", timestamp: 1, data: { message: {
      role: "user", content: [{ type: "image", attachmentId, attachmentState: "ready", data: fittedData, mimeType: "image/png" }],
    } } });
    const app = buildApp({ s1: { sessionFile: "/tmp/absent-display-original.jsonl" } }, undefined, { eventStore });
    try {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.toString("base64")).toBe(fittedData);
    } finally { await app.close(); }
  });

  it("fits one transcript original through the shared pool when resident data is absent, leaving original GET unchanged", async () => {
    const sessionFile = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const fitWorkerPool = poolWith();
    const eventStore = createMemoryEventStore(() => false);
    eventStore.insertEvent("s1", { eventType: "message_end", timestamp: 1, data: { message: {
      role: "user", content: [{ type: "image", attachmentId, attachmentState: "ready", data: "", mimeType: "image/png" }],
    } } });
    const app = buildApp({ s1: { sessionFile } }, undefined, { eventStore, fitWorkerPool });
    try {
      const display = await app.inject({ url });
      expect(display.statusCode).toBe(200);
      expect(display.rawPayload.toString("base64")).toBe(fittedData);
      expect(fitWorkerPool.fit).toHaveBeenCalledExactlyOnceWith({ blocks: [{ blockIndex: 0, data: PNG_B64, mimeType: "image/png" }] });
      const original = await app.inject({ url: url.split("?")[0] });
      expect(original.statusCode).toBe(200);
      expect(original.rawPayload.toString("base64")).toBe(PNG_B64);
      expect(fitWorkerPool.fit).toHaveBeenCalledTimes(1);
    } finally { await app.close(); }
  });

  it("preserves network, session, hash, transcript ownership and original MIME gates for display", async () => {
    const sessionFile = transcriptWith([]);
    const eventStore = createMemoryEventStore(() => false);
    eventStore.insertEvent("s2", { eventType: "attachment_fitted", timestamp: 1,
      data: { attachmentId, state: "ready", data: fittedData, mimeType: "image/png" } });
    const fitWorkerPool = poolWith();
    const evil = Buffer.from("<svg/> ").toString("base64");
    const app = buildApp({ s1: { sessionFile }, s2: { sessionFile: transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]) },
      evil: { sessionFile: transcriptWith([{ data: evil, mimeType: "image/svg+xml" }]) } }, undefined, { eventStore, fitWorkerPool });
    const denied = buildApp({ s1: { sessionFile } }, async (_req, reply) => { reply.code(403).send({ success: false }); }, { eventStore, fitWorkerPool });
    try {
      expect((await denied.inject({ url })).statusCode).toBe(403);
      expect((await app.inject({ url })).statusCode).toBe(404);
      expect((await app.inject({ url: "/api/sessions/s1/attachments/bad?display=1" })).statusCode).toBe(400);
      expect((await app.inject({ url: "/api/sessions/ghost/attachments/bad?display=1" })).statusCode).toBe(404);
      expect((await app.inject({ url: `/api/sessions/evil/attachments/${sha(evil)}?display=1` })).statusCode).toBe(404);
      expect(fitWorkerPool.fit).not.toHaveBeenCalled();
    } finally { await app.close(); await denied.close(); }
  });

  it("rejects failed, empty, oversized, malformed and unallowlisted worker derivatives", async () => {
    const sessionFile = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    for (const patch of [{ failed: true }, { data: "" }, { data: "A".repeat(DISPLAY_MAX_BYTES + 4) },
      { data: "%%%" }, { mimeType: "image/svg+xml" }]) {
      const app = buildApp({ s1: { sessionFile } }, undefined, { fitWorkerPool: poolWith({ ...fittedBlock, ...patch }) });
      try {
        const res = await app.inject({ url });
        expect(res.statusCode).toBe(404);
        expect(res.headers["content-type"]).not.toContain("image/");
      } finally { await app.close(); }
    }
  });

  it("refuses invalid resident MIME or over-budget bytes", async () => {
    for (const patch of [{ mimeType: "text/html" }, { data: "A".repeat(DISPLAY_MAX_BYTES + 4) }, { data: "%%%" }, { state: "failed" }, { data: "" }]) {
      const eventStore = { getEvents: vi.fn(() => [{ seq: 1, bytes: 0, event: { eventType: "attachment_fitted", timestamp: 1,
        data: { attachmentId, state: "ready", data: fittedData, mimeType: "image/png", ...patch } } }]) };
      const fitWorkerPool = poolWith();
      const app = buildApp({ s1: { sessionFile: "/tmp/absent-display-original.jsonl" } }, undefined, { eventStore, fitWorkerPool });
      try {
        expect((await app.inject({ url })).statusCode).toBe(404);
        expect(eventStore.getEvents).toHaveBeenCalledExactlyOnceWith("s1", 1);
        expect(fitWorkerPool.fit).not.toHaveBeenCalled();
      } finally { await app.close(); }
    }
  });

  it("returns honest 503 without a pool but continues to serve originals", async () => {
    const sessionFile = transcriptWith([{ data: PNG_B64, mimeType: "image/png" }]);
    const app = buildApp({ s1: { sessionFile } });
    try {
      expect((await app.inject({ url })).statusCode).toBe(503);
      expect((await app.inject({ url: url.split("?")[0] })).rawPayload.toString("base64")).toBe(PNG_B64);
    } finally { await app.close(); }
  });
});
