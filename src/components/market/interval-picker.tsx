import type { MarketInterval } from "@/repositories/domain";

import { formatIntervalLabel } from "@/application/market-planning";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

type IntervalPickerProps = {
  intervals: MarketInterval[];
  selectedId: string;
  timezone: string;
};

export function IntervalPicker({
  intervals,
  selectedId,
  timezone,
}: IntervalPickerProps) {
  return (
    <form method="get" className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <FieldGroup className="flex-1">
        <Field>
          <FieldLabel htmlFor="intervalId">15-minute interval</FieldLabel>
          <select
            id="intervalId"
            name="intervalId"
            defaultValue={selectedId}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            {intervals.map((interval) => (
              <option key={interval.id} value={interval.id}>
                {formatIntervalLabel(interval, timezone)}
              </option>
            ))}
          </select>
          <FieldDescription>
            Times use the community timezone, {timezone}.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" variant="outline">
        View interval
      </Button>
    </form>
  );
}
