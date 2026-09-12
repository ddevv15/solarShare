import type { Metadata } from "next";
import { CalendarClock, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurrentViewerState } from "@/app/_lib/current-viewer";
import { loadBuyerMarketplace } from "@/application/buyer-marketplace";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeDecimalString } from "@/domain/decimal";
import { createClient } from "@/lib/supabase/server";
import {
  createCommunityRepository,
  createMarketRepository,
} from "@/repositories/supabase/caller";

import { signOut } from "@/app/(app)/actions";
import { ReservationForm } from "@/app/(app)/marketplace/reservation-form";

export const metadata: Metadata = {
  title: "Community marketplace | SolarShare",
};

type MarketplacePageProps = {
  searchParams: Promise<{ intervalId?: string | string[] }>;
};

export default async function MarketplacePage({
  searchParams,
}: MarketplacePageProps) {
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
  const marketplace = await loadBuyerMarketplace(
    viewer,
    {
      community: createCommunityRepository(client),
      market: createMarketRepository(client),
    },
    requestedIntervalId,
  );

  const firstOffer = marketplace.offers[0];
  const pricedPreview =
    marketplace.pricingPreview?.outcome === "priced"
      ? marketplace.pricingPreview
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Community marketplace"
        title="Reserve local solar with a clear limit"
        description="Choose one seeded interval, compare the available energy and seller limit, then review your maximum cost and saving before submitting."
      />

      {!marketplace.selectedInterval ? (
        <FeedbackState
          state="empty"
          title="No marketplace intervals"
          description="The seeded scenario has no interval available for this community."
        />
      ) : (
        <>
          <Card aria-labelledby="market-interval-title">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CalendarClock aria-hidden="true" className="text-primary" />
                <div className="flex flex-col gap-1">
                  <CardTitle id="market-interval-title">
                    Marketplace interval
                  </CardTitle>
                  <CardDescription>
                    Only open 15-minute windows can be selected for a new
                    reservation.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <IntervalPicker
                intervals={marketplace.intervals}
                selectedId={marketplace.selectedInterval.id}
                timezone={viewer.community.timezone}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <StatusLabel tone="success">Interval open</StatusLabel>
              <StatusLabel>
                {formatIntervalLabel(
                  marketplace.selectedInterval,
                  viewer.community.timezone,
                )}
              </StatusLabel>
            </CardFooter>
          </Card>

          <Card aria-labelledby="offers-title">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Store aria-hidden="true" className="text-primary" />
                <div className="flex flex-col gap-1">
                  <CardTitle id="offers-title">Available local solar</CardTitle>
                  <CardDescription>
                    Household aliases are public inside the community; private
                    readings and identities are not.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {marketplace.offers.length ? (
                <Table
                  className="min-w-xl"
                  scrollRegionLabel="Available local solar offers"
                >
                  <TableCaption>
                    Active seller offers for the selected interval.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Seller</TableHead>
                      <TableHead scope="col">Available</TableHead>
                      <TableHead scope="col">Seller limit</TableHead>
                      <TableHead scope="col">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marketplace.offers.map((offer) => (
                      <TableRow key={offer.listingId}>
                        <TableCell className="font-medium">
                          {offer.alias}
                        </TableCell>
                        <TableCell>
                          {normalizeDecimalString(offer.availableKwh)} kWh
                        </TableCell>
                        <TableCell>
                          {offer.limitPrice
                            ? `₹${normalizeDecimalString(offer.limitPrice)}/kWh`
                            : "No seller limit"}
                        </TableCell>
                        <TableCell>
                          <SourceLabel
                            source={
                              offer.sourceLabel === "connected"
                                ? "live"
                                : "sample"
                            }
                            label={offer.sourceLabel}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <FeedbackState
                  state="empty"
                  title="No solar offered in this interval"
                  description="Choose another 15-minute window or ask the seller to publish an offer."
                />
              )}
            </CardContent>
            {marketplace.tariff ? (
              <CardFooter className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <SourceLabel source="sample" label="Stored tariff assumption" />
                <span>
                  Feed-in ₹
                  {normalizeDecimalString(marketplace.tariff.feedInRate)}
                  /kWh · retail ₹
                  {normalizeDecimalString(marketplace.tariff.retailRate)}/kWh
                </span>
              </CardFooter>
            ) : null}
          </Card>

          {marketplace.selectedInterval.status === "open" &&
          firstOffer &&
          marketplace.tariff ? (
            <ReservationForm
              key={marketplace.selectedInterval.id}
              idempotencyKey={crypto.randomUUID()}
              intervalId={marketplace.selectedInterval.id}
              initialQuantityKwh={normalizeDecimalString(
                firstOffer.availableKwh,
              )}
              initialMaximumPrice={normalizeDecimalString(
                firstOffer.limitPrice ?? marketplace.tariff.retailRate,
              )}
              marketUnitPrice={
                pricedPreview
                  ? normalizeDecimalString(pricedPreview.unitPrice)
                  : undefined
              }
              pricingSummary={
                marketplace.pricingPreview?.explanation.summary ??
                "A market price preview is not available."
              }
              retailRate={normalizeDecimalString(marketplace.tariff.retailRate)}
            />
          ) : marketplace.offers.length ? (
            <FeedbackState
              state="failure"
              title="Reservation estimate unavailable"
              description={
                marketplace.pricingPreview?.explanation.summary ??
                "An active community tariff is required before cost and saving can be estimated."
              }
            />
          ) : null}
        </>
      )}
    </>
  );
}
