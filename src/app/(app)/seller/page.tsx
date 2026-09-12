import type { Metadata } from "next";
import { CalendarClock, CircleHelp } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurrentViewerState } from "@/app/_lib/current-viewer";
import {
  forecastMetrics,
  loadSellerSharingPlan,
  type ForecastMetric,
} from "@/application/seller-sharing";
import { formatIntervalLabel } from "@/application/market-planning";
import { FeedbackState } from "@/components/foundation/feedback-state";
import { PageHeader } from "@/components/foundation/page-header";
import { SourceLabel } from "@/components/foundation/source-label";
import { StatusLabel } from "@/components/foundation/status-label";
import { IntervalPicker } from "@/components/market/interval-picker";
import { ViewerAccessFeedback } from "@/components/viewer-access-feedback";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { normalizeDecimalString } from "@/domain/decimal";
import { createClient } from "@/lib/supabase/server";
import type { Forecast } from "@/repositories/domain";
import {
  createEnergyDataRepository,
  createMarketRepository,
} from "@/repositories/supabase/caller";

import { signOut } from "@/app/(app)/actions";
import { OfferForm } from "@/app/(app)/seller/offer-form";

export const metadata: Metadata = {
  title: "Seller forecast | SolarShare",
};

const metricCopy: Record<
  ForecastMetric,
  { label: string; description: string }
> = {
  generation: {
    label: "Expected generation",
    description: "Solar energy expected from the rooftop system.",
  },
  consumption: {
    label: "Expected home use",
    description: "Household demand protected before sharing.",
  },
  reserve: {
    label: "Protected reserve",
    description: "Energy held back for the household.",
  },
  surplus: {
    label: "Shareable surplus",
    description: "Generation left after home use and reserve.",
  },
};

function sourceKind(sourceType: string): "live" | "cache" | "sample" {
  if (sourceType === "connected") return "live";
  if (sourceType === "cache") return "cache";
  return "sample";
}

function formatIssuedAt(forecast: Forecast, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(forecast.issuedAt));
}

type SellerPageProps = {
  searchParams: Promise<{ intervalId?: string | string[] }>;
};

export default async function SellerPage({ searchParams }: SellerPageProps) {
  const viewerState = await getCurrentViewerState();
  if (viewerState.status === "anonymous") redirect("/sign-in");
  if (viewerState.status === "unresolved") {
    return (
      <ViewerAccessFeedback
        reason={viewerState.reason}
        signOutAction={signOut}
      />
    );
  }
  const { viewer } = viewerState;

  const query = await searchParams;
  const requestedIntervalId =
    typeof query.intervalId === "string" ? query.intervalId : undefined;
  const client = await createClient();
  const plan = await loadSellerSharingPlan(
    viewer,
    {
      energyData: createEnergyDataRepository(client),
      market: createMarketRepository(client),
    },
    requestedIntervalId,
  );

  return (
    <>
      <PageHeader
        eyebrow="Guided sharing"
        title="Review tomorrow’s solar surplus"
        description="Choose a 15-minute window, check the four seeded estimates, then publish the amount and minimum price you are comfortable sharing."
      />

      {!plan.selectedInterval ? (
        <FeedbackState
          state="empty"
          title="No planning intervals"
          description="The seeded scenario has no interval available for this household."
        />
      ) : (
        <>
          <Card aria-labelledby="interval-title">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CalendarClock aria-hidden="true" className="text-primary" />
                <div className="flex flex-col gap-1">
                  <CardTitle id="interval-title">Planning interval</CardTitle>
                  <CardDescription>
                    Only seeded intervals that are open for new offers are
                    available here.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <IntervalPicker
                intervals={plan.intervals}
                selectedId={plan.selectedInterval.id}
                timezone={viewer.community.timezone}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <StatusLabel tone="success">Interval open</StatusLabel>
              <StatusLabel>
                {formatIntervalLabel(
                  plan.selectedInterval,
                  viewer.community.timezone,
                )}
              </StatusLabel>
            </CardFooter>
          </Card>

          <section
            aria-labelledby="forecast-title"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <h2
                id="forecast-title"
                className="text-2xl font-semibold tracking-tight"
              >
                Forecast breakdown
              </h2>
              <p className="text-muted-foreground">
                Every value is an estimate for the selected 15-minute window.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {forecastMetrics.map((metric) => {
                const forecast = plan.forecasts[metric];
                const copy = metricCopy[metric];
                return (
                  <Card key={metric}>
                    <CardHeader>
                      <CardTitle>{copy.label}</CardTitle>
                      <CardDescription>{copy.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold tracking-tight">
                        {forecast
                          ? `${normalizeDecimalString(forecast.valueKwh)} kWh`
                          : "Unavailable"}
                      </p>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2">
                      {forecast ? (
                        <>
                          <SourceLabel
                            source={sourceKind(forecast.sourceType)}
                            label={`${forecast.sourceType} · ${forecast.modelVersion}`}
                          />
                          <span className="text-sm text-muted-foreground">
                            Issued{" "}
                            {formatIssuedAt(
                              forecast,
                              viewer.community.timezone,
                            )}
                          </span>
                        </>
                      ) : (
                        <StatusLabel tone="warning">No estimate</StatusLabel>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </section>

          <Card aria-labelledby="calculation-title">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CircleHelp aria-hidden="true" className="text-primary" />
                <div className="flex flex-col gap-1">
                  <CardTitle id="calculation-title">
                    How the suggestion is calculated
                  </CardTitle>
                  <CardDescription>
                    The seed keeps the calculation traceable and repeatable.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <details className="rounded-lg bg-muted p-4">
                <summary className="min-h-11 cursor-pointer py-2 font-medium">
                  Show calculation and visibility rule
                </summary>
                <div className="flex flex-col gap-3 pt-3 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    Shareable surplus is expected generation minus expected home
                    use and protected reserve, never below zero.
                  </p>
                  <p>
                    Forecast visibility uses the start of this interval as its
                    cutoff. A forecast issued after the interval starts is not
                    selected.
                  </p>
                </div>
              </details>
            </CardContent>
          </Card>

          {plan.forecasts.surplus && plan.tariff ? (
            <OfferForm
              key={plan.selectedInterval.id}
              idempotencyKey={crypto.randomUUID()}
              intervalId={plan.selectedInterval.id}
              suggestedQuantityKwh={normalizeDecimalString(
                plan.forecasts.surplus.valueKwh,
              )}
              minimumPrice={normalizeDecimalString(plan.tariff.feedInRate)}
            />
          ) : (
            <FeedbackState
              state="failure"
              title="Offer controls unavailable"
              description="A current surplus forecast and active tariff are both required before an offer can be published."
            />
          )}
        </>
      )}
    </>
  );
}
