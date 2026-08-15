import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useExternalEvents } from "@/lib/useExternalEvents";

const event = {
  id: "icloud-1",
  title: "Dentist",
  start: "2026-03-10T14:00:00.000Z",
  end: "2026-03-10T15:00:00.000Z",
  allDay: false,
};

const RANGE = ["2026-03-01", "2026-04-11"] as const;

describe("useExternalEvents", () => {
  test("loads the events for the visible range", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ events: [event], ok: true }));

    const { result } = renderHook(() => useExternalEvents(...RANGE));

    await waitFor(() => expect(result.current.ok).toBe(true));
    expect(result.current.events).toEqual([event]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/external-events?start=2026-03-01&end=2026-04-11",
    );
  });

  test("a degraded response yields no events and no thrown error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ events: [], ok: false }));

    const { result } = renderHook(() => useExternalEvents(...RANGE));

    await waitFor(() => expect(result.current.events).toEqual([]));
    expect(result.current.ok).toBe(false);
  });

  test("a network failure is swallowed rather than surfaced", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useExternalEvents(...RANGE));

    await waitFor(() => expect(result.current.ok).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  test("a non-OK response does not become an events list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "Bad range" }, { status: 400 }),
    );

    const { result } = renderHook(() => useExternalEvents(...RANGE));

    await waitFor(() => expect(result.current.ok).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  test("nothing is fetched before the range is known", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    renderHook(() => useExternalEvents("", ""));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("changing month aborts the in-flight request for the old range", async () => {
    const signals: AbortSignal[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      signals.push(init!.signal as AbortSignal);
      return Promise.resolve(Response.json({ events: [], ok: true }));
    });

    const { rerender } = renderHook(({ start, end }) => useExternalEvents(start, end), {
      initialProps: { start: "2026-03-01", end: "2026-04-11" },
    });
    rerender({ start: "2026-04-01", end: "2026-05-11" });

    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
