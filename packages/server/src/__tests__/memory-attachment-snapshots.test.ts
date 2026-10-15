import type { DashboardEvent } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { describe, expect, it } from "vitest";
import {
  createMemoryEventStore,
  measureBytes,
} from "../persistence/memory-event-store.js";

const pending = (id = "image-a"): DashboardEvent => ({
  eventType: "message_end",
  timestamp: 1,
  data: {
    message: {
      role: "user",
      content: [
        { type: "text", text: "Keep this message" },
        {
          type: "image",
          attachmentId: id,
          attachmentState: "pending",
          mimeType: "image/png",
          data: "",
        },
      ],
    },
  },
});
const fitted = (
  id = "image-a",
  data = "fitted-bytes",
  state = "ready",
): DashboardEvent => ({
  eventType: "attachment_fitted",
  timestamp: 2,
  data: { attachmentId: id, data, state, mimeType: "image/png" },
});
const images = (event: DashboardEvent | undefined) =>
  (
    event?.data.message as { content: Array<Record<string, unknown>> }
  ).content.filter((b) => b.type === "image");

describe("retained attachment snapshots", () => {
  it("resolves all retained occurrences without mutating source or earlier snapshots", () => {
    const store = createMemoryEventStore(() => false);
    const input = pending();
    const seq = store.insertEvent("s", input);
    const before = store.getEvent("s", seq);
    store.insertEvent("s", { ...input, eventType: "message_start" });
    store.insertEvent("other", input);
    store.insertEvent("s", fitted());
    expect(images(input)[0].attachmentState).toBe("pending");
    expect(images(before)[0].attachmentState).toBe("pending");
    expect(images(store.getEvent("s", seq))[0]).toMatchObject({
      attachmentState: "ready",
      data: "fitted-bytes",
    });
    expect(images(store.getEvent("s", 2))[0].attachmentState).toBe("ready");
    expect(images(store.getEvent("other", 1))[0].attachmentState).toBe(
      "pending",
    );
  });

  it("a late duplicate placeholder cannot undo the retained resolution, even after its patch event was trimmed", () => {
    const store = createMemoryEventStore(() => false, 32, 3);
    store.insertEvent("s", pending());
    store.insertEvent("s", fitted());
    store.insertEvent("s", pending());
    for (let i = 0; i < 2; i++)
      store.insertEvent("s", {
        eventType: "message_end",
        timestamp: 3 + i,
        data: { message: { role: "assistant", content: [] } },
      });
    expect(
      store
        .getEvents("s", 1)
        .some((e) => e.event.eventType === "attachment_fitted"),
    ).toBe(false);
    const seq = store.insertEvent("s", pending());
    expect(images(store.getEvent("s", seq))[0]).toMatchObject({
      attachmentState: "ready",
      data: "fitted-bytes",
    });
  });

  it("persists explicit failure and uses the latest resolution", () => {
    const store = createMemoryEventStore(() => false);
    const seq = store.insertEvent("s", pending());
    store.insertEvent("s", fitted("image-a", "", "failed"));
    expect(images(store.getEvent("s", seq))[0]).toMatchObject({
      attachmentState: "failed",
      data: "",
    });
    store.insertEvent("s", fitted("image-a", "new-bytes"));
    store.insertEvent("s", fitted("image-a", "new-bytes"));
    expect(images(store.getEvent("s", seq))[0]).toMatchObject({
      attachmentState: "ready",
      data: "new-bytes",
    });
    const events = store.getEvents("s", 1);
    const sum = events.reduce(
      (n, e) => n + measureBytes(e.event.data, 1_000_000),
      0,
    );
    expect(store.getBufferBytes("s")).toBe(sum);
    expect(store.getRetention().residentBytes).toBe(sum);
  });

  it("preserves text and the event ceiling when several fitted images cannot fit one row", () => {
    const store = createMemoryEventStore(() => false, 32, 0, 0, 500);
    const input = pending();
    (input.data.message as { content: unknown[] }).content.push({
      type: "image",
      attachmentId: "image-b",
      attachmentState: "pending",
      mimeType: "image/png",
      data: "",
    });
    const seq = store.insertEvent("s", input);
    store.insertEvent("s", fitted("image-a", "x".repeat(120)));
    store.insertEvent("s", fitted("image-b", "y".repeat(120)));
    const row = store.getEvent("s", seq)!;
    expect(JSON.stringify(row.data)).toContain("Keep this message");
    expect(
      images(row).every((image) => image.attachmentState === "ready"),
    ).toBe(true);
    expect(images(row).some((image) => image.data === "")).toBe(true);
    expect(
      store
        .getEvents("s", 1)
        .filter((e) => e.event.eventType === "attachment_fitted")
        .map((e) => e.event.data.data),
    ).toEqual(["x".repeat(120), "y".repeat(120)]);
    expect(Buffer.byteLength(JSON.stringify(row.data))).toBeLessThanOrEqual(
      500,
    );
    expect(store.getBufferBytes("s")).toBe(
      store.getEvents("s", 1).reduce((n, e) => n + e.bytes, 0),
    );
    const duplicate = store.insertEvent("s", input);
    expect(
      images(store.getEvent("s", duplicate)).every(
        (image) => image.attachmentState === "ready",
      ),
    ).toBe(true);
    const single = store.insertEvent("s", pending());
    expect(images(store.getEvent("s", single))[0].attachmentState).toBe(
      "ready",
    );
  });

  it("an over-cap MIME replacement cannot bypass the ceiling or undercount bytes", () => {
    const store = createMemoryEventStore(() => false, 32, 0, 0, 500);
    const input = pending();
    (
      input.data.message as { content: Array<{ text?: string }> }
    ).content[0].text = "t".repeat(140);
    const seq = store.insertEvent("s", input);
    const completion = fitted("image-a", "x".repeat(80));
    completion.data.mimeType = `image/${"p".repeat(200)}`;
    expect(Buffer.byteLength(JSON.stringify(completion.data))).toBeLessThan(
      500,
    );
    store.insertEvent("s", completion);
    const row = store.getEvent("s", seq)!;
    expect(Buffer.byteLength(JSON.stringify(row.data))).toBeLessThanOrEqual(
      500,
    );
    expect(images(row)[0]).toMatchObject({
      attachmentState: "ready",
      data: "",
      mimeType: "image/png",
    });
    const bytes = store
      .getEvents("s", 1)
      .reduce((n, e) => n + measureBytes(e.event.data, 500), 0);
    expect(store.getBufferBytes("s")).toBe(bytes);
    expect(store.getRetention().residentBytes).toBe(bytes);
  });
});
