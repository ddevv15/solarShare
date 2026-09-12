import type { MarketInterval } from "@/repositories/domain";
import type { MarketRepository } from "@/repositories/ports";

const scenarioWindow = {
  from: "2000-01-01T00:00:00Z",
  to: "2100-01-01T00:00:00Z",
} as const;

function localDateKey(timestamp: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function listScenarioPlanningIntervals(
  repository: MarketRepository,
  communityId: string,
  timezone: string,
): Promise<MarketInterval[]> {
  const intervals: MarketInterval[] = [];
  let cursor: string | undefined;

  do {
    const page = await repository.listIntervals(
      communityId,
      scenarioWindow.from,
      scenarioWindow.to,
      { limit: 100, ...(cursor ? { cursor } : {}) },
    );
    intervals.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  const groups = new Map<string, MarketInterval[]>();

  for (const interval of intervals) {
    const key = localDateKey(interval.intervalStart, timezone);
    groups.set(key, [...(groups.get(key) ?? []), interval]);
  }

  const selected = [...groups.entries()].sort(
    ([leftKey, left], [rightKey, right]) =>
      right.length - left.length || rightKey.localeCompare(leftKey),
  )[0]?.[1];

  return (selected ?? [])
    .filter((interval) => interval.status === "open")
    .sort((left, right) =>
      left.intervalStart.localeCompare(right.intervalStart),
    );
}

export function selectPlanningInterval(
  intervals: MarketInterval[],
  requestedId?: string,
): MarketInterval | null {
  const open = intervals.filter((interval) => interval.status === "open");
  const requested = requestedId
    ? open.find((interval) => interval.id === requestedId)
    : undefined;
  if (requested) return requested;

  return open[Math.floor(open.length / 2)] ?? null;
}

export function formatIntervalLabel(
  interval: MarketInterval,
  timezone: string,
): string {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(interval.intervalStart))}–${timeFormatter.format(new Date(interval.intervalEnd))}`;
}
