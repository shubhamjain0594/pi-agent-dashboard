import { afterEach, describe, expect, it, vi } from "vitest";
import { piDashboardConsole } from "../logging.js";

afterEach(() => {
  delete process.env.PI_DASHBOARD_DEBUG;
  vi.restoreAllMocks();
});

describe("piDashboardConsole", () => {
  it("always writes errors, even when debug is off", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.PI_DASHBOARD_DEBUG;

    piDashboardConsole.error("failure");

    expect(error).toHaveBeenCalledWith("failure");
  });

  it("suppresses non-error output unless debug is exactly 1", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.PI_DASHBOARD_DEBUG;

    piDashboardConsole.log("log");
    piDashboardConsole.info("info");
    piDashboardConsole.warn("warn");
    process.env.PI_DASHBOARD_DEBUG = "true";
    piDashboardConsole.log("not enabled");

    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();

    process.env.PI_DASHBOARD_DEBUG = "1";
    piDashboardConsole.log("debug");
    piDashboardConsole.info("debug");
    piDashboardConsole.warn("debug");

    expect(log).toHaveBeenCalledWith("debug");
    expect(info).toHaveBeenCalledWith("debug");
    expect(warn).toHaveBeenCalledWith("debug");
  });
});
