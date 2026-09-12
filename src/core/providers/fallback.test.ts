import { describe, expect, it, vi } from "vitest";

import {
  ProviderReadError,
  type ProviderCandidate,
  type ProviderLogger,
} from "./contract";
import { createFallbackProvider } from "./fallback";

type Input = { interval: string };
type Output = { watts: number };

function candidate(
  name: string,
  source: "live" | "cache" | "sample",
  read: ProviderCandidate<Input, Output>["read"],
): ProviderCandidate<Input, Output> {
  return { name, source, read };
}

function logger() {
  return { warn: vi.fn<ProviderLogger["warn"]>() };
}

const input = { interval: "2026-09-13T12:00:00+05:30" };

describe("createFallbackProvider", () => {
  it("returns live data without using a fallback", async () => {
    const testLogger = logger();
    const liveRead = vi.fn().mockResolvedValue({ watts: 1400 });
    const cacheRead = vi.fn().mockResolvedValue({ watts: 1300 });
    const sampleRead = vi.fn().mockResolvedValue({ watts: 1200 });
    const provider = createFallbackProvider({
      live: candidate("Open Meteo live", "live", liveRead),
      cache: candidate("weather cache", "cache", cacheRead),
      sample: candidate("stored weather sample", "sample", sampleRead),
      logger: testLogger,
    });

    const result = await provider.read(input);

    expect(result).toEqual({
      value: { watts: 1400 },
      source: "live",
      sourceLabel: "Open Meteo live",
      degraded: false,
      failures: [],
    });
    expect(liveRead).toHaveBeenCalledWith(input);
    expect(cacheRead).not.toHaveBeenCalled();
    expect(sampleRead).not.toHaveBeenCalled();
    expect(testLogger.warn).not.toHaveBeenCalled();
  });

  it("uses cached data after a live provider failure", async () => {
    const testLogger = logger();
    const provider = createFallbackProvider({
      live: candidate("PVGIS live", "live", async () => {
        throw new ProviderReadError("PROVIDER_TIMEOUT");
      }),
      cache: candidate("solar cache", "cache", async () => ({ watts: 900 })),
      sample: candidate("stored solar sample", "sample", async () => ({
        watts: 800,
      })),
      logger: testLogger,
    });

    const result = await provider.read(input);

    expect(result).toEqual({
      value: { watts: 900 },
      source: "cache",
      sourceLabel: "solar cache",
      degraded: true,
      failures: [{ provider: "PVGIS live", code: "PROVIDER_TIMEOUT" }],
    });
    expect(testLogger.warn).toHaveBeenCalledWith("provider_fallback", {
      provider: "PVGIS live",
      code: "PROVIDER_TIMEOUT",
      nextSource: "cache",
    });
  });

  it("uses stored sample data when live and cache candidates fail", async () => {
    const testLogger = logger();
    const provider = createFallbackProvider({
      live: candidate("Open Meteo live", "live", async () => {
        throw new Error("response included private upstream details");
      }),
      cache: candidate("weather cache", "cache", async () => {
        throw new ProviderReadError("CACHE_MISS");
      }),
      sample: candidate("stored weather sample", "sample", async () => ({
        watts: 700,
      })),
      logger: testLogger,
    });

    const result = await provider.read(input);

    expect(result).toEqual({
      value: { watts: 700 },
      source: "sample",
      sourceLabel: "stored weather sample",
      degraded: true,
      failures: [
        { provider: "Open Meteo live", code: "PROVIDER_UNAVAILABLE" },
        { provider: "weather cache", code: "CACHE_MISS" },
      ],
    });
    expect(testLogger.warn).toHaveBeenNthCalledWith(1, "provider_fallback", {
      provider: "Open Meteo live",
      code: "PROVIDER_UNAVAILABLE",
      nextSource: "cache",
    });
    expect(testLogger.warn).toHaveBeenNthCalledWith(2, "provider_fallback", {
      provider: "weather cache",
      code: "CACHE_MISS",
      nextSource: "sample",
    });
    expect(JSON.stringify(result)).not.toContain("private upstream details");
  });

  it("uses the stored sample directly when optional providers are absent", async () => {
    const testLogger = logger();
    const sampleRead = vi.fn().mockResolvedValue({ watts: 600 });
    const provider = createFallbackProvider({
      sample: candidate("stored provider sample", "sample", sampleRead),
      logger: testLogger,
    });

    const result = await provider.read(input);

    expect(result.source).toBe("sample");
    expect(result.degraded).toBe(true);
    expect(result.failures).toEqual([]);
    expect(sampleRead).toHaveBeenCalledWith(input);
    expect(testLogger.warn).not.toHaveBeenCalled();
  });

  it("reports a safe error after every candidate fails", async () => {
    const testLogger = logger();
    const provider = createFallbackProvider({
      live: candidate("live", "live", async () => {
        throw new ProviderReadError("LIVE_FAILED");
      }),
      cache: candidate("cache", "cache", async () => {
        throw new ProviderReadError("CACHE_FAILED");
      }),
      sample: candidate("sample", "sample", async () => {
        throw new ProviderReadError("SAMPLE_FAILED");
      }),
      logger: testLogger,
    });

    const error = await provider.read(input).catch((caught) => caught);

    expect(error).toBeInstanceOf(ProviderReadError);
    expect(error.code).toBe("PROVIDER_FALLBACK_EXHAUSTED");
    expect(error.message).toBe(
      "A provider candidate could not return validated data.",
    );
    expect(error.cause).toEqual([
      { provider: "live", code: "LIVE_FAILED" },
      { provider: "cache", code: "CACHE_FAILED" },
      { provider: "sample", code: "SAMPLE_FAILED" },
    ]);
    expect(testLogger.warn).toHaveBeenCalledTimes(2);
  });
});
