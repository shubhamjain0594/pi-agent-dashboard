import type { ServerToBrowserMessage } from "@blackbelt-technology/pi-dashboard-shared/browser-protocol.js";
import type { DashboardEvent } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import type { WebSocket } from "ws";
import {
  createInitialState,
  reduceEvent,
} from "../../../client/src/lib/chat/event-reducer.js";
import {
  buildFittedEvent,
  prepareEventForIngest,
} from "../attachments/attachment-ingest.js";
import { sendEventBatches } from "../browser-handlers/subscription-handler.js";
import {
  createMemoryEventStore,
  type EventStore,
  measureBytes,
  type StoredEvent,
} from "../persistence/memory-event-store.js";
import { registerAttachmentRoutes } from "../routes/attachment-routes.js";
import type { SessionManager } from "../session/memory-session-manager.js";

const SESSION = "attachment-retention";
// A real PNG, not merely a truthy string: replay must carry the derivative bytes.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=";

function insertMessage(store: EventStore, sessionId = SESSION) {
  const prepared = prepareEventForIngest({
    eventType: "message_start",
    timestamp: 1,
    data: {
      entryId: "image-row",
      message: {
        role: "user",
        content: [
          { type: "text", text: "Inspect this screenshot" },
          { type: "image", data: PNG, mimeType: "image/png" },
        ],
      },
    },
  });
  const start = prepared.event;
  const end = {
    ...structuredClone(start),
    eventType: "message_end",
    timestamp: 2,
  };
  const original = structuredClone([start, end]);
  const startSeq = store.insertEvent(sessionId, start);
  const endSeq = store.insertEvent(sessionId, end);
  return {
    start,
    end,
    original,
    startSeq,
    endSeq,
    attachmentId: prepared.pending[0].attachmentId,
  };
}

function noise(store: EventStore, count: number) {
  for (let i = 0; i < count; i++) {
    store.insertEvent(SESSION, {
      eventType: "diagnostic_noise",
      timestamp: 10 + i,
      data: { tick: i },
    });
  }
}

async function replay(rows: StoredEvent[], windowLimit?: number) {
  const frames: ServerToBrowserMessage[] = [];
  const ws = { readyState: 1, OPEN: 1, bufferedAmount: 0 } as WebSocket;
  const highWater = await sendEventBatches(
    ws,
    SESSION,
    rows,
    (_ws, frame) => {
      // Exercise the JSON wire shape, not shared in-memory object references.
      frames.push(JSON.parse(JSON.stringify(frame)));
    },
    windowLimit,
  );
  let state = createInitialState();
  const delivered: Array<{ seq: number; event: DashboardEvent }> = [];
  for (const frame of frames) {
    if (frame.type === "session_state_reset") state = createInitialState();
    if (frame.type !== "event_replay") continue;
    delivered.push(...frame.events);
    for (const row of frame.events) state = reduceEvent(state, row.event);
  }
  return { frames, state, delivered, highWater };
}

function expectImage(
  result: Awaited<ReturnType<typeof replay>>,
  attachmentId: string,
  state: "ready" | "failed" | "pending",
) {
  const messages = result.state.messages.filter(
    (message) => message.role === "user",
  );
  expect(messages).toHaveLength(1);
  expect(messages[0].content).toBe("Inspect this screenshot");
  expect(messages[0].images).toHaveLength(1);
  const image = messages[0].images![0];
  expect(image).toMatchObject({
    attachmentId,
    attachmentState: state,
    mimeType: "image/png",
  });
  expect(Buffer.from(image.data, "base64")).toEqual(
    Buffer.from(state === "ready" ? PNG : "", "base64"),
  );
}

function expectExactAccounting(store: EventStore) {
  const rows = store.getEvents(SESSION, 1);
  for (const row of rows)
    expect(row.bytes).toBe(measureBytes(row.event.data, 16_384));
  const bytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  expect(store.getBufferBytes(SESSION)).toBe(bytes);
  expect(store.getRetention().residentBytes).toBe(bytes);
}

describe("attachment resolution survives retention and replay cuts", () => {
  it("renders over-cap multi-image messages as ready fitted references across a replay cut", async () => {
    const prepared = prepareEventForIngest({
      eventType: "message_start",
      timestamp: 1,
      data: {
        message: {
          role: "user",
          content: [
            { type: "text", text: "Inspect both images" },
            ...Array.from({ length: 2 }, () => ({
              type: "image",
              data: PNG,
              mimeType: "image/png",
            })),
          ],
        },
      },
    });
    const cap = measureBytes(prepared.event.data, 1_000_000) + 16;
    const store = createMemoryEventStore(() => false, 2, 200, 0, cap);
    store.insertEvent(SESSION, prepared.event);
    store.insertEvent(SESSION, { ...prepared.event, eventType: "message_end" });
    noise(store, 27);
    const attachmentId = prepared.pending[0].attachmentId;
    const fittedSeq = store.insertEvent(
      SESSION,
      buildFittedEvent({
        attachmentId,
        data: PNG,
        mimeType: "image/png",
        state: "ready",
      }),
    );
    noise(store, 60);
    const result = await replay(store.getEvents(SESSION, 1), 40);
    expect(result.delivered.some((row) => row.seq === fittedSeq)).toBe(false);
    const images = result.state.messages.find(
      (message) => message.role === "user",
    )!.images!;
    expect(images).toHaveLength(2);
    expect(
      images.every(
        (image) => image.attachmentState === "ready" && image.data === "",
      ),
    ).toBe(true);
    for (const row of store.getEvents(SESSION, 1))
      expect(
        Buffer.byteLength(JSON.stringify(row.event.data)),
      ).toBeLessThanOrEqual(cap);
    const app = Fastify();
    registerAttachmentRoutes(app, {
      sessionManager: {
        get: () => ({
          sessionFile: "/does-not-exist/should-not-be-read.jsonl",
        }),
      } as unknown as SessionManager,
      eventStore: store,
      networkGuard: async () => {},
    });
    try {
      const response = await app.inject({
        url: `/api/sessions/${SESSION}/attachments/${attachmentId}?display=1`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.rawPayload).toEqual(Buffer.from(PNG, "base64"));
      expect(response.headers["cache-control"]).toBe("no-store, private");
    } finally {
      await app.close();
    }
  });

  it("retains live resolution events alongside messages when count trimming sheds telemetry", async () => {
    const store = createMemoryEventStore(
      () => false,
      2,
      8,
      128,
      16_384,
      65_536,
      131_072,
    );
    const message = insertMessage(store);
    const fitted = buildFittedEvent({
      attachmentId: message.attachmentId,
      data: PNG,
      mimeType: "image/png",
      state: "ready",
    });
    const fittedSeq = store.insertEvent(SESSION, fitted);
    // The phase-2 event remains available for the existing live broadcast path.
    expect(store.getEvent(SESSION, fittedSeq)).toEqual(fitted);
    expectExactAccounting(store);
    noise(store, 24);
    const retained = store.getEvents(SESSION, 1);
    expect(store.getTrimStats().trimmedEvents.total).toBeGreaterThan(0);
    expect(retained.length).toBeLessThanOrEqual(8);
    expect(retained.some((row) => row.seq === message.startSeq)).toBe(true);
    expect(retained.some((row) => row.seq === message.endSeq)).toBe(true);
    expect(store.getEvent(SESSION, fittedSeq)?.eventType).toBe(
      "attachment_fitted",
    );
    expect([message.start, message.end]).toEqual(message.original);
    expectExactAccounting(store);
    expect(store.getBufferBytes(SESSION)).toBeLessThanOrEqual(
      store.getRetention().effective.maxBytesPerSession,
    );
    const result = await replay(retained, 0);
    expect(result.highWater).toBe(store.getMaxSeq(SESSION));
    // No attachment resolver or original-file HTTP fetch participates in replay.
    expectImage(result, message.attachmentId, "ready");
  });

  it("keeps head/tail, full, delta and backfill-shaped reads self-contained without the fitted row", async () => {
    const store = createMemoryEventStore(() => false, 2, 200);
    const message = insertMessage(store);
    noise(store, 27);
    const fittedSeq = store.insertEvent(
      SESSION,
      buildFittedEvent({
        attachmentId: message.attachmentId,
        data: PNG,
        mimeType: "image/png",
        state: "ready",
      }),
    );
    noise(store, 60);
    const windowed = await replay(store.getEvents(SESSION, 1), 40);
    expect(
      windowed.frames.some((frame) => frame.type === "history_window"),
    ).toBe(true);
    expect(windowed.delivered.some((row) => row.seq === message.startSeq)).toBe(
      true,
    );
    expect(windowed.delivered.some((row) => row.seq === fittedSeq)).toBe(false);
    expect(store.getEvent(SESSION, fittedSeq)?.eventType).toBe(
      "attachment_fitted",
    );
    expectImage(windowed, message.attachmentId, "ready");
    // Restrict via the actual store read APIs. Starts of visible user messages
    // must render without their separate completion. A message_end alone does
    // not create a user row in the client reducer (that is the start's job).
    const reads = [
      store.getEvents(SESSION, 1).filter((row) => row.seq < fittedSeq),
      store
        .getEvents(SESSION, message.startSeq)
        .filter((row) => row.seq < fittedSeq),
      store.getEventsRange(SESSION, message.startSeq, message.startSeq),
      store.getEventsEndingAt(SESSION, 1, message.endSeq, 2),
    ];
    for (const rows of reads) {
      expect(
        rows.some((row) => row.event.eventType === "attachment_fitted"),
      ).toBe(false);
      expectImage(await replay(rows), message.attachmentId, "ready");
    }
  });

  it("retains explicit failure, including a ready resolution with missing bytes", async () => {
    for (const state of ["failed", "ready"] as const) {
      const store = createMemoryEventStore(() => false, 2, 8);
      const message = insertMessage(store);
      store.insertEvent(
        SESSION,
        buildFittedEvent({
          attachmentId: message.attachmentId,
          data: "",
          mimeType: "image/png",
          state,
        }),
      );
      noise(store, 24);
      const retained = store.getEvents(SESSION, 1);
      expect(
        retained.some((row) => row.event.eventType === "attachment_fitted"),
      ).toBe(true);
      expectImage(await replay(retained), message.attachmentId, "failed");
      expect([message.start, message.end]).toEqual(message.original);
      expectExactAccounting(store);
    }
  });

  it("does not resolve a missing or unmatched attachment, or a matching id in another session", async () => {
    const store = createMemoryEventStore(() => false, 3, 8);
    const message = insertMessage(store);
    insertMessage(store, "other-session");
    store.insertEvent(
      "other-session",
      buildFittedEvent({
        attachmentId: message.attachmentId,
        data: PNG,
        mimeType: "image/png",
        state: "ready",
      }),
    );
    store.insertEvent(
      SESSION,
      buildFittedEvent({
        attachmentId: "unknown-id",
        data: PNG,
        mimeType: "image/png",
        state: "ready",
      }),
    );
    store.insertEvent(SESSION, {
      eventType: "attachment_fitted",
      timestamp: 3,
      data: { data: PNG, mimeType: "image/png", state: "ready" },
    });
    noise(store, 24);
    expectImage(
      await replay(store.getEvents(SESSION, 1)),
      message.attachmentId,
      "pending",
    );
    expect([message.start, message.end]).toEqual(message.original);
  });
});
