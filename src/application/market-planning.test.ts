import { describe, expect, it, vi } from "vitest";

import {
  formatIntervalLabel,
  listScenarioPlanningIntervals,
  selectPlanningInterval,
} from "@/application/market-planning";
import type { MarketInterval } from "@/repositories/domain";
import type { MarketRepository } from "@/repositories/ports";

const interval = (
  id: string,
  intervalStart: string,
  status = "open",
): MarketInterval => ({
  id,
  communityId: "community",
  intervalStart,
  intervalEnd: new Date(
    new Date(intervalStart).getTime() + 15 * 60 * 1000,
  ).toISOString(),
  status,
  updatedAt: intervalStart,
});

function repositoryWithIntervals(items: MarketInterval[]): MarketRepository {
  return {
    listIntervals: vi.fn().mockResolvedValue({ items }),
    getTariffForInterval: vi.fn(),
    submitOffer: vi.fn(),
    getFeederForInterval: vi.fn(),
    createOffer: vi.fn(),
    updateOffer: vi.fn(),
    submitReservation: vi.fn(),
    createReservation: vi.fn(),
    updateReservation: vi.fn(),
    getAllocation: vi.fn(),
    listOwnSettlements: vi.fn(),
  };
}

describe("market planning intervals", () => {
  it("selects the complete seeded local day instead of depending on now", async () => {
    const historical = interval("history", "2026-09-11T18:30:00.000Z");
    const anchorLate = interval("anchor-2", "2026-09-12T18:45:00.000Z");
    const anchorEarly = interval("anchor-1", "2026-09-12T18:30:00.000Z");
    const repository = repositoryWithIntervals([
      historical,
      anchorLate,
      anchorEarly,
    ]);

    const result = await listScenarioPlanningIntervals(
      repository,
      "community",
      "Asia/Kolkata",
    );

    expect(result.map((item) => item.id)).toEqual(["anchor-1", "anchor-2"]);
    expect(repository.listIntervals).toHaveBeenCalledWith(
      "community",
      "2000-01-01T00:00:00Z",
      "2100-01-01T00:00:00Z",
      { limit: 100 },
    );
  });

  it("loads every interval page before choosing the seeded planning day", async () => {
    const historical = Array.from({ length: 96 }, (_, index) =>
      interval(
        `history-${index}`,
        new Date(
          new Date("2026-09-11T18:30:00.000Z").getTime() +
            index * 15 * 60 * 1000,
        ).toISOString(),
        "planned",
      ),
    );
    const anchor = Array.from({ length: 96 }, (_, index) =>
      interval(
        `anchor-${index}`,
        new Date(
          new Date("2026-09-12T18:30:00.000Z").getTime() +
            index * 15 * 60 * 1000,
        ).toISOString(),
        index === 95 ? "open" : "planned",
      ),
    );
    const repository = repositoryWithIntervals([]);
    vi.mocked(repository.listIntervals)
      .mockResolvedValueOnce({
        items: [...historical, ...anchor.slice(0, 4)],
        nextCursor: "next-page",
      })
      .mockResolvedValueOnce({ items: anchor.slice(4) });

    const result = await listScenarioPlanningIntervals(
      repository,
      "community",
      "Asia/Kolkata",
    );

    expect(result.map((item) => item.id)).toEqual(["anchor-95"]);
    expect(repository.listIntervals).toHaveBeenNthCalledWith(
      2,
      "community",
      "2000-01-01T00:00:00Z",
      "2100-01-01T00:00:00Z",
      { limit: 100, cursor: "next-page" },
    );
  });

  it("uses the requested interval when it belongs to the planning day", () => {
    const intervals = [
      interval("one", "2026-09-12T18:30:00.000Z"),
      interval("two", "2026-09-12T18:45:00.000Z"),
    ];

    expect(selectPlanningInterval(intervals, "one")?.id).toBe("one");
  });

  it("does not return an explicitly requested planned interval", () => {
    const intervals = [
      interval("planned", "2026-09-12T18:30:00.000Z", "planned"),
      interval("open", "2026-09-12T18:45:00.000Z"),
    ];

    expect(selectPlanningInterval(intervals, "planned")?.id).toBe("open");
  });

  it("returns null when the planning day has no open interval", () => {
    const intervals = [
      interval("planned", "2026-09-12T18:30:00.000Z", "planned"),
    ];

    expect(selectPlanningInterval(intervals, "planned")).toBeNull();
  });

  it("defaults to the midpoint open interval", () => {
    const intervals = [
      interval("one", "2026-09-12T18:30:00.000Z"),
      interval("two", "2026-09-12T18:45:00.000Z", "paused"),
      interval("three", "2026-09-12T19:00:00.000Z"),
      interval("four", "2026-09-12T19:15:00.000Z"),
    ];

    expect(selectPlanningInterval(intervals)?.id).toBe("three");
  });

  it("formats interval bounds in the community timezone", () => {
    const value = interval("noon", "2026-09-13T06:30:00.000Z");

    const label = formatIntervalLabel(value, "Asia/Kolkata");

    expect(label).toContain("12:00 pm");
    expect(label).toContain("12:15 pm");
  });
});
