import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatImage } from "../../../lib/chat/event-reducer.js";
import { ImageAttachments } from "../ChatView.js";

const id = "a".repeat(64);
const pending: ChatImage = { data: "", mimeType: "image/png", attachmentId: id, attachmentState: "pending" };
const original = `/api/sessions/session/attachments/${id}`;
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe("transcript attachment recovery", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("waits for the pending grace period before using the original img endpoint", () => {
    render(<ImageAttachments images={[pending]} sessionId="session" />);
    expect(screen.getByTestId("attachment-pending")).toBeTruthy();
    advance(2999);
    expect(screen.queryByTestId("attachment-image")).toBeNull();
    advance(1);
    expect(screen.getByTestId("attachment-image").getAttribute("src")).toBe(original);
  });

  it("keeps the fitted ready fast path and cancels the grace timer", () => {
    const { rerender } = render(<ImageAttachments images={[pending]} sessionId="session" />);
    advance(2000);
    rerender(<ImageAttachments images={[{ ...pending, attachmentState: "ready", data: "fitted" }]} sessionId="session" />);
    advance(20000);
    expect(screen.getByTestId("attachment-image").getAttribute("src")).toBe("data:image/png;base64,fitted");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("tries a failed derivative immediately, then only retries on explicit activation", () => {
    render(<ImageAttachments images={[{ ...pending, attachmentState: "failed" }]} sessionId="session" />);
    fireEvent.error(screen.getByTestId("attachment-image"));
    expect(screen.getByTestId("attachment-failed").textContent).toContain("image unavailable");
    advance(60000);
    expect(screen.queryByTestId("attachment-image")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(screen.getByTestId("attachment-image").getAttribute("src")).toBe(original);
    fireEvent.error(screen.getByTestId("attachment-image"));
    advance(60000);
    expect(screen.queryByTestId("attachment-image")).toBeNull();
  });

  it("bounds a stalled original and cancels its timer on unmount", () => {
    const { unmount } = render(<ImageAttachments images={[pending]} sessionId="session" />);
    advance(3000);
    advance(9999);
    expect(screen.getByTestId("attachment-image")).toBeTruthy();
    advance(1);
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores old completion handlers after Retry arms a new attempt", () => {
    const onImageLoad = vi.fn();
    render(<ImageAttachments images={[pending]} sessionId="session" onImageLoad={onImageLoad} />);
    advance(3000);
    const oldImage = screen.getByTestId("attachment-image");
    // Detached nodes do not bubble into React's delegated event listener.
    // Retain the actual old render's callbacks to exercise a queued completion.
    const propsKey = Object.keys(oldImage).find((key) => key.startsWith("__reactProps$"))!;
    const oldHandlers = (oldImage as unknown as Record<string, {
      onLoad: (event: unknown) => void;
      onError: () => void;
    }>)[propsKey];
    fireEvent.error(oldImage);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    act(() => {
      oldHandlers.onLoad({ currentTarget: oldImage, target: oldImage });
      oldHandlers.onError();
    });
    expect(onImageLoad).not.toHaveBeenCalled();
    expect(screen.queryByTestId("attachment-failed")).toBeNull();
    fireEvent.load(screen.getByTestId("attachment-image"));
    expect(onImageLoad).toHaveBeenCalledTimes(1);
    advance(20000);
    expect(screen.queryByTestId("attachment-failed")).toBeNull();
  });

  it("accepts a cached image load before passive effects run", () => {
    const onImageLoad = vi.fn();
    function CachedOriginal() {
      useLayoutEffect(() => {
        fireEvent.load(screen.getByTestId("attachment-image"));
      }, []);
      return <ImageAttachments images={[{ ...pending, attachmentState: "failed" }]} sessionId="session" onImageLoad={onImageLoad} />;
    }
    render(<CachedOriginal />);
    expect(onImageLoad).toHaveBeenCalledTimes(1);
    advance(20000);
    expect(screen.queryByTestId("attachment-failed")).toBeNull();
    expect(screen.getByRole("button", { name: "Zoom attachment 1" }).hasAttribute("disabled")).toBe(false);
  });

  it.each(["session", "id"])("resets recovery on %s change and ignores the old image", (change) => {
    const onImageLoad = vi.fn();
    const { rerender } = render(<ImageAttachments images={[pending]} sessionId="session" onImageLoad={onImageLoad} />);
    advance(3000);
    const oldImage = screen.getByTestId("attachment-image");
    const next = change === "id" ? { ...pending, attachmentId: "b".repeat(64) } : pending;
    const session = change === "session" ? "other/session" : "session";
    rerender(<ImageAttachments images={[next]} sessionId={session} onImageLoad={onImageLoad} />);
    fireEvent.load(oldImage);
    expect(onImageLoad).not.toHaveBeenCalled();
    expect(screen.getByTestId("attachment-pending")).toBeTruthy();
    advance(3000);
    expect(screen.getByTestId("attachment-image").getAttribute("src")).toBe(`/api/sessions/${encodeURIComponent(session)}/attachments/${next.attachmentId}`);
    advance(7000);
    expect(screen.queryByTestId("attachment-failed")).toBeNull();
  });

  it("measures a recovered image and exposes native-button zoom to the same lightbox", () => {
    const onImageLoad = vi.fn();
    render(<ImageAttachments images={[pending]} sessionId="session" onImageLoad={onImageLoad} />);
    advance(3000);
    const image = screen.getByTestId("attachment-image");
    fireEvent.load(image);
    expect(onImageLoad).toHaveBeenCalledTimes(1);
    expect(onImageLoad.mock.calls[0][0].target).toBe(image);
    advance(20000);
    expect(screen.queryByTestId("attachment-failed")).toBeNull();
    const zoom = screen.getByRole("button", { name: "Zoom attachment 1" });
    expect(zoom.tagName).toBe("BUTTON");
    expect(zoom.hasAttribute("disabled")).toBe(false);
    fireEvent.click(zoom);
    expect(screen.getByTestId("lightbox-image").getAttribute("src")).toBe(original);
  });

  it("cancels in-flight recovery when a fitted ready image arrives", () => {
    const onImageLoad = vi.fn();
    const { rerender } = render(<ImageAttachments images={[pending]} sessionId="session" onImageLoad={onImageLoad} />);
    advance(3000);
    const oldImage = screen.getByTestId("attachment-image");
    rerender(<ImageAttachments images={[{ ...pending, attachmentState: "ready", data: "fitted" }]} sessionId="session" onImageLoad={onImageLoad} />);
    fireEvent.load(oldImage);
    advance(20000);
    expect(onImageLoad).not.toHaveBeenCalled();
    expect(screen.getByTestId("attachment-image").getAttribute("src")).toContain("base64,fitted");
  });

  it.each([undefined, "invalid"])("never requests an original with invalid/missing id %s", (attachmentId) => {
    render(<ImageAttachments images={[{ ...pending, attachmentId }]} sessionId="session" />);
    advance(30000);
    expect(screen.queryByTestId("attachment-image")).toBeNull();
    expect(screen.getByTestId("attachment-failed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
