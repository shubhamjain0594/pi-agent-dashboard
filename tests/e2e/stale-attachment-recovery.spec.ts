import { expect, test, type Page } from "./fixtures.js";

const sessionId = "stale-attachment-fixture";
const attachmentId = "a".repeat(64);
const originalPath = `/api/sessions/${sessionId}/attachments/${attachmentId}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=", "base64");

async function replayPendingImage(page: Page) {
  await page.routeWebSocket("**/ws**", (socket) => {
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.type !== "subscribe" || message.sessionId !== sessionId) return;
      const user = { role: "user", content: [
        { type: "text", text: "An image whose completion event is outside the loaded history window" },
        { type: "image", data: "", mimeType: "image/png", attachmentId, attachmentState: "pending" },
      ] };
      socket.send(JSON.stringify({ type: "event_replay", sessionId, isLast: true, events: [
        { seq: 1, event: { eventType: "message_start", timestamp: 1, data: { message: user } } },
        { seq: 2, event: { eventType: "message_end", timestamp: 2, data: { message: user } } },
      ] }));
    });
    setTimeout(() => socket.send(JSON.stringify({ type: "sessions_snapshot", sessions: [{
      id: sessionId, cwd: "/work/attachment-fixture", name: "Attachment recovery", status: "idle", source: "dashboard", startedAt: 1,
    }], orders: {}, endedTotals: {}, archivedCountByCwd: {} })), 100);
  });
  await page.goto(`/session/${sessionId}`);
}

test("pending transcript images recover from the saved original without loading the history gap", async ({ page }) => {
  await page.route(`**${originalPath}`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: png }));
  await replayPendingImage(page);
  const image = page.getByTestId("attachment-image");
  await expect(image).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByTestId("attachment-pending")).toHaveCount(0);
});

test("an unavailable original settles instead of spinning or retrying indefinitely", async ({ page }) => {
  let attempts = 0;
  await page.route(`**${originalPath}`, (route) => {
    attempts++;
    return route.fulfill({ status: 404, body: "Image unavailable" });
  });
  await replayPendingImage(page);
  await expect(page.getByTestId("attachment-failed")).toBeVisible({ timeout: 15_000 });
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: /retry/i }).click();
  await expect.poll(() => attempts).toBe(2);
});
