import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionDiff } from "../useSessionDiff.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const payload = (path: string) => ({
  success: true,
  data: { files: [{ path, changes: [] }], isGitRepo: true },
});

describe("useSessionDiff request ownership", () => {
  it("ignores a previous session’s late response", async () => {
    let resolveOld!: (response: unknown) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: true, json: async () => payload("new.ts") });
    vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(({ id }) => useSessionDiff(id), {
      initialProps: { id: "old" },
    });
    rerender({ id: "new" });
    expect(result.current.data).toBeNull();
    await waitFor(() =>
      expect(result.current.data?.files[0].path).toBe("new.ts"),
    );
    await act(async () =>
      resolveOld({ ok: true, json: async () => payload("old.ts") }),
    );
    expect(result.current.data?.files[0].path).toBe("new.ts");
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("keeps the newest refresh and ignores an aborted one", async () => {
    let resolveFirst!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockResolvedValueOnce({
          ok: true,
          json: async () => payload("latest.ts"),
        }),
    );
    const { result } = renderHook(() => useSessionDiff("one"));
    await act(async () => result.current.refresh());
    expect(result.current.data?.files[0].path).toBe("latest.ts");
    await act(async () =>
      resolveFirst({ ok: true, json: async () => payload("stale.ts") }),
    );
    expect(result.current.data?.files[0].path).toBe("latest.ts");
  });

  it("shows HTTP failures as errors, not an empty change list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    const { result } = renderHook(() => useSessionDiff("one"));
    await waitFor(() => expect(result.current.error).toContain("503"));
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("does not fetch for an absent session", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    renderHook(() => useSessionDiff(undefined));
    expect(fetch).not.toHaveBeenCalled();
  });
});
