/**
 * Desktop conversation header can exit a live session. Ended sessions and
 * callers that omit onShutdown render no control. A streaming session asks
 * before shutdown. Mobile keeps Exit inside the action menu.
 */
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../lib/chat/event-reducer.js";

function makeSession(overrides?: Partial<DashboardSession>): DashboardSession {
  return {
    id: "s1",
    status: "idle",
    cwd: "/tmp",
    startedAt: Date.now() - 60_000,
    ...overrides,
  } as DashboardSession;
}

describe("SessionHeader exit — desktop", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("../../hooks/useMobile.js");
  });

  async function loadDesktop() {
    vi.doMock("../../hooks/useMobile.js", () => ({ useMobile: () => false }));
    const mod = await import("../session/SessionHeader.js");
    return mod.SessionHeader;
  }

  it("exits an idle session without a confirm", async () => {
    const SessionHeader = await loadDesktop();
    const onShutdown = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <SessionHeader session={makeSession()} state={createInitialState()} onShutdown={onShutdown} />,
    );
    fireEvent.click(screen.getByTestId("session-header-exit"));
    expect(confirm).not.toHaveBeenCalled();
    expect(onShutdown).toHaveBeenCalledOnce();
  });

  it("asks before exiting a streaming session", async () => {
    const SessionHeader = await loadDesktop();
    const onShutdown = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const session = makeSession({ status: "streaming" });
    const view = render(
      <SessionHeader session={session} state={createInitialState()} onShutdown={onShutdown} />,
    );
    fireEvent.click(screen.getByTestId("session-header-exit"));
    expect(onShutdown).not.toHaveBeenCalled();
    view.rerender(
      <SessionHeader session={session} state={createInitialState()} onShutdown={onShutdown} />,
    );
    fireEvent.click(screen.getByTestId("session-header-exit"));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onShutdown).toHaveBeenCalledOnce();
  });

  it("hides exit for an ended session and when shutdown is unwired", async () => {
    const SessionHeader = await loadDesktop();
    const { rerender } = render(
      <SessionHeader
        session={makeSession({ status: "ended" })}
        state={createInitialState()}
        onShutdown={() => {}}
      />,
    );
    expect(screen.queryByTestId("session-header-exit")).toBeNull();
    rerender(<SessionHeader session={makeSession()} state={createInitialState()} />);
    expect(screen.queryByTestId("session-header-exit")).toBeNull();
  });

  it("disables exit while the session is closing", async () => {
    const SessionHeader = await loadDesktop();
    const onShutdown = vi.fn();
    render(
      <SessionHeader
        session={makeSession({ closing: true })}
        state={createInitialState()}
        onShutdown={onShutdown}
      />,
    );
    const button = screen.getByTestId("session-header-exit");
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(onShutdown).not.toHaveBeenCalled();
  });
});
