"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { MarketActionState } from "@/app/(app)/_lib/market-action-state";
import { getCurrentViewerState } from "@/app/_lib/current-viewer";
import { submitBuyerReservation } from "@/application/buyer-marketplace";
import { ViewerAccessError } from "@/application/viewer";
import { compareDecimalStrings } from "@/domain/decimal";
import { createClient } from "@/lib/supabase/server";
import { RepositoryError } from "@/repositories/errors";
import { decimal6Schema, uuidSchema } from "@/repositories/schemas";
import {
  createCommunityRepository,
  createMarketRepository,
} from "@/repositories/supabase/caller";

const positiveDecimal = decimal6Schema.refine(
  (value) => compareDecimalStrings(value, "0") > 0,
  "Enter a quantity greater than zero.",
);

const reservationActionSchema = z.object({
  idempotencyKey: uuidSchema,
  intervalId: uuidSchema,
  quantityKwh: positiveDecimal,
  maximumPrice: decimal6Schema,
});

export async function reserveEnergyAction(
  _previousState: MarketActionState,
  formData: FormData,
): Promise<MarketActionState> {
  const parsed = reservationActionSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    intervalId: formData.get("intervalId"),
    quantityKwh: formData.get("quantityKwh"),
    maximumPrice: formData.get("maximumPrice"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      status: "failure",
      message: "Check the quantity and price limit, then try again.",
      fieldErrors: {
        quantityKwh: errors.quantityKwh,
        price: errors.maximumPrice,
      },
    };
  }

  const viewerState = await getCurrentViewerState();
  if (viewerState.status !== "resolved") {
    return {
      status: "failure",
      message: "Your session ended. Sign in again before reserving.",
    };
  }
  const { viewer } = viewerState;

  const client = await createClient();
  try {
    const reservation = await submitBuyerReservation(
      viewer,
      {
        community: createCommunityRepository(client),
        market: createMarketRepository(client),
      },
      parsed.data,
    );
    revalidatePath("/marketplace");
    return {
      status: "success",
      message: "Your request is active and pending market matching.",
      result: {
        id: reservation.id,
        state: reservation.status,
        quantityKwh: reservation.quantityKwh,
      },
    };
  } catch (error) {
    if (
      error instanceof RepositoryError ||
      error instanceof ViewerAccessError
    ) {
      return { status: "failure", message: error.message };
    }
    throw error;
  }
}
