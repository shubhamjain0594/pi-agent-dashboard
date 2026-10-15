import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { DesktopWorkbench } from "../DesktopWorkbench.js";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(sessionPage = false) {
  const location = memoryLocation({ path: sessionPage ? "/session/one" : "/" });
  const onSelect = vi.fn();
  const navigate = vi.fn();
  const onToggleSidebar = vi.fn();
  render(
    <Router hook={location.hook}>
    <DesktopWorkbench
      sessions={[
        {
          id: "one",
          name: "Build navigation",
          cwd: "/work/app",
          source: "dashboard",
          status: "idle",
          startedAt: 100,
        } as DashboardSession,
      ]}
      folders={["/work/app"]}
      status="connected"
      sidebarCollapsed={false}
      onToggleSidebar={onToggleSidebar}
      onSelect={onSelect}
      navigate={navigate}
      onAddFolder={vi.fn()}
    >
      <div>Existing workspace</div>
    </DesktopWorkbench>
    </Router>,
  );
  return { onSelect, navigate, onToggleSidebar };
}

describe("DesktopWorkbench", () => {
  it("removes the redundant titlebar on session pages while keeping rail search and sidebar controls", () => {
    const { onToggleSidebar } = setup(true);
    expect(document.querySelector(".workbench-titlebar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quick open" }));
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Toggle sessions" }));
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("preserves its existing surface and renders real connection state", () => {
    setup();
    expect(screen.getByText("Existing workspace")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeTruthy();
  });

  it("filters commands and opens a session with Enter", () => {
    const { onSelect } = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Search sessions and projects" }),
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "navigation" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("one");
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("routes settings through the shell's tracked navigation callback", () => {
    const { navigate } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  it("does not steal shortcuts from another dialog or repeat key events", () => {
    const { onToggleSidebar } = setup();
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.append(other);
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(onToggleSidebar).not.toHaveBeenCalled();
    other.remove();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true, repeat: true });
    expect(onToggleSidebar).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("offers a searchable empty state", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Quick open" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "no such session" },
    });
    expect(screen.getByRole("status").textContent).toContain(
      "No matching sessions or projects.",
    );
  });
});
