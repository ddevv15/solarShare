import type { Metadata } from "next";
import { CalendarClock, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/app/_lib/current-viewer";
import { loadBuyerMarketplace } from "@/application/buyer-marketplace";
import { formatIntervalLabel } from "@/application/market-planning";
import { FeedbackState } from "@/components/foundation/feedback-state";
import { PageHeader } from "@/components/foundation/page-header";
import { SourceLabel } from "@/components/foundation/source-label";
import { StatusLabel } from "@/components/foundation/status-label";
import { IntervalPicker } from "@/components/market/interval-picker";
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

import { ReservationForm } from "./reservation-form";

export const metadata: Metadata = {
  title: "Community marketplace | SolarShare",
};

type MarketplacePageProps = {
  searchParams: Promise<{ intervalId?: string | string[] }>;
};

export default async function MarketplacePage({
  searchParams,
}: MarketplacePageProps) {
  const viewer = await getCurrentViewer();
  if (!viewer) redirect("/sign-in");

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
  const initialMaximumPrice =
    firstOffer?.limitPrice ?? marketplace.tariff?.retailRate;

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
                    The market is grouped into keyboard-selectable 15-minute
                    windows.
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
                <Table>
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

          {firstOffer && marketplace.tariff && initialMaximumPrice ? (
            <ReservationForm
              key={marketplace.selectedInterval.id}
              intervalId={marketplace.selectedInterval.id}
              initialQuantityKwh={normalizeDecimalString(
                firstOffer.availableKwh,
              )}
              initialMaximumPrice={normalizeDecimalString(initialMaximumPrice)}
              retailRate={normalizeDecimalString(marketplace.tariff.retailRate)}
            />
          ) : marketplace.offers.length ? (
            <FeedbackState
              state="failure"
              title="Reservation estimate unavailable"
              description="An active community tariff is required before cost and saving can be estimated."
            />
          ) : null}
        </>
      )}
    </>
  );
}
