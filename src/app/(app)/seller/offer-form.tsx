"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";

import { initialMarketActionState } from "@/app/(app)/_lib/market-action-state";
import { FeedbackState } from "@/components/foundation/feedback-state";
import { SourceLabel } from "@/components/foundation/source-label";
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

import { publishOfferAction } from "./actions";

type OfferFormProps = {
  intervalId: string;
  suggestedQuantityKwh: string;
  minimumPrice: string;
};

export function OfferForm({
  intervalId,
  suggestedQuantityKwh,
  minimumPrice,
}: OfferFormProps) {
  const [state, formAction, pending] = useActionState(
    publishOfferAction,
    initialMarketActionState,
  );
  const quantityError = state.fieldErrors?.quantityKwh?.[0];
  const priceError = state.fieldErrors?.price?.[0];

  return (
    <Card aria-labelledby="publish-offer-title">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="publish-offer-title">Publish this surplus</CardTitle>
          <SourceLabel source="sample" label="Stored tariff assumption" />
        </div>
        <CardDescription>
          Approve the forecast quantity as shown or enter a smaller or larger
          manual quantity. Auto Adjust remains off for this first release.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="intervalId" value={intervalId} />
          {state.status === "success" ? (
            <FeedbackState
              state="success"
              title="Offer published"
              description={`${state.result?.quantityKwh ?? suggestedQuantityKwh} kWh is ${state.result?.state ?? "open"} for matching.`}
            />
          ) : null}
          {state.status === "failure" ? (
            <FeedbackState
              state="failure"
              title="Offer not published"
              description={state.message}
            />
          ) : null}

          <FieldGroup className="sm:grid sm:grid-cols-2">
            <Field data-invalid={Boolean(quantityError)}>
              <FieldLabel htmlFor="quantityKwh">Quantity to share</FieldLabel>
              <Input
                id="quantityKwh"
                name="quantityKwh"
                inputMode="decimal"
                defaultValue={suggestedQuantityKwh}
                pattern="(0|[1-9][0-9]*)(\.[0-9]{1,6})?"
                aria-invalid={Boolean(quantityError)}
                aria-describedby={
                  quantityError ? "quantity-error" : "quantity-description"
                }
                required
              />
              <FieldDescription id="quantity-description">
                kWh for this interval. The suggested amount is the forecast
                surplus.
              </FieldDescription>
              {quantityError ? (
                <FieldError id="quantity-error">{quantityError}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(priceError)}>
              <FieldLabel htmlFor="minimumPrice">Minimum price</FieldLabel>
              <Input
                id="minimumPrice"
                name="minimumPrice"
                inputMode="decimal"
                defaultValue={minimumPrice}
                pattern="(0|[1-9][0-9]*)(\.[0-9]{1,6})?"
                aria-invalid={Boolean(priceError)}
                aria-describedby={
                  priceError
                    ? "minimum-price-error"
                    : "minimum-price-description"
                }
                required
              />
              <FieldDescription id="minimum-price-description">
                INR per kWh. This begins at the seeded feed-in rate and remains
                your explicit seller limit.
              </FieldDescription>
              {priceError ? (
                <FieldError id="minimum-price-error">{priceError}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" disabled={pending}>
            <Send data-icon="inline-start" aria-hidden="true" />
            {pending ? "Publishing offer…" : "Publish offer"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm leading-relaxed text-muted-foreground">
        The minimum price is a seeded community tariff assumption, not a utility
        tariff claim. Matching and calculated prices arrive in later features.
      </CardFooter>
    </Card>
  );
}
