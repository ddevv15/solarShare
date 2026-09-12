"use client";

import { ShoppingBasket } from "lucide-react";
import { useActionState, useState } from "react";

import { initialMarketActionState } from "@/app/(app)/_lib/market-action-state";
import { FeedbackState } from "@/components/foundation/feedback-state";
import { StatusLabel } from "@/components/foundation/status-label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { estimateReservation } from "@/domain/decimal";

import { reserveEnergyAction } from "./actions";

type ReservationFormProps = {
  idempotencyKey: string;
  intervalId: string;
  initialQuantityKwh: string;
  initialMaximumPrice: string;
  marketUnitPrice?: string;
  pricingSummary: string;
  retailRate: string;
};

function estimate(
  quantityKwh: string,
  marketUnitPrice: string | undefined,
  maximumPrice: string,
  retailRate: string,
) {
  if (!marketUnitPrice) return null;

  try {
    return estimateReservation(
      quantityKwh,
      marketUnitPrice,
      maximumPrice,
      retailRate,
    );
  } catch {
    return { estimatedCost: "—", estimatedSaving: "—" };
  }
}

export function ReservationForm({
  idempotencyKey,
  intervalId,
  initialQuantityKwh,
  initialMaximumPrice,
  marketUnitPrice,
  pricingSummary,
  retailRate,
}: ReservationFormProps) {
  const [quantityKwh, setQuantityKwh] = useState(initialQuantityKwh);
  const [maximumPrice, setMaximumPrice] = useState(initialMaximumPrice);
  const [state, formAction, pending] = useActionState(
    reserveEnergyAction,
    initialMarketActionState,
  );
  const preview = estimate(
    quantityKwh,
    marketUnitPrice,
    maximumPrice,
    retailRate,
  );
  const quantityError = state.fieldErrors?.quantityKwh?.[0];
  const priceError = state.fieldErrors?.price?.[0];

  return (
    <Card aria-labelledby="reservation-title">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="reservation-title">Reserve local solar</CardTitle>
          <StatusLabel>Pending after submission</StatusLabel>
        </div>
        <CardDescription>
          Set the energy you want and the most you will pay per kWh. The
          estimate updates locally before anything is submitted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="intervalId" value={intervalId} />
          {state.status === "success" ? (
            <FeedbackState
              state="success"
              title="Reservation pending matching"
              description={`${state.result?.quantityKwh ?? quantityKwh} kWh is active and waiting for allocation.`}
            />
          ) : null}
          {state.status === "failure" ? (
            <FeedbackState
              state="failure"
              title="Reservation not submitted"
              description={state.message}
            />
          ) : null}

          <FieldGroup className="sm:grid sm:grid-cols-2">
            <Field data-invalid={Boolean(quantityError)}>
              <FieldLabel htmlFor="quantityKwh">Energy requested</FieldLabel>
              <Input
                id="quantityKwh"
                name="quantityKwh"
                inputMode="decimal"
                value={quantityKwh}
                onChange={(event) => setQuantityKwh(event.target.value)}
                pattern="(0|[1-9][0-9]*)(\.[0-9]{1,6})?"
                aria-invalid={Boolean(quantityError)}
                aria-describedby={
                  quantityError ? "quantity-error" : "quantity-description"
                }
                required
              />
              <FieldDescription id="quantity-description">
                kWh for this single 15-minute interval.
              </FieldDescription>
              {quantityError ? (
                <FieldError id="quantity-error">{quantityError}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(priceError)}>
              <FieldLabel htmlFor="maximumPrice">Maximum price</FieldLabel>
              <Input
                id="maximumPrice"
                name="maximumPrice"
                inputMode="decimal"
                value={maximumPrice}
                onChange={(event) => setMaximumPrice(event.target.value)}
                pattern="(0|[1-9][0-9]*)(\.[0-9]{1,6})?"
                aria-invalid={Boolean(priceError)}
                aria-describedby={
                  priceError
                    ? "maximum-price-error"
                    : "maximum-price-description"
                }
                required
              />
              <FieldDescription id="maximum-price-description">
                INR per kWh. The first offer limit is used as the starting
                point.
              </FieldDescription>
              {priceError ? (
                <FieldError id="maximum-price-error">{priceError}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>

          {preview ? (
            <dl className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">
                  Estimated maximum cost
                </dt>
                <dd className="text-xl font-semibold">
                  ₹{preview.estimatedCost}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">
                  Estimated saving vs retail
                </dt>
                <dd className="text-xl font-semibold">
                  ₹{preview.estimatedSaving}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="rounded-lg bg-muted p-4">
              <p className="font-medium">
                The final unit price is not determined yet.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Submit the most you will pay per kWh. Cost and saving estimates
                will be available after the market has active demand.
              </p>
            </div>
          )}

          <Button type="submit" size="lg" disabled={pending}>
            <ShoppingBasket data-icon="inline-start" aria-hidden="true" />
            {pending ? "Submitting reservation…" : "Submit reservation"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm leading-relaxed text-muted-foreground">
        {marketUnitPrice ? (
          <span>
            {pricingSummary} Your estimate uses this price, capped by your
            maximum, and compares it with the active seeded retail rate. Final
            cost waits for matching and settlement.
          </span>
        ) : (
          <span>
            {pricingSummary} Your maximum price remains a limit. Final cost
            waits for pricing, matching, and settlement.
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
