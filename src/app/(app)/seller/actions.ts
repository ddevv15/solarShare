"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { MarketActionState } from "@/app/(app)/_lib/market-action-state";
import { getCurrentViewer } from "@/app/_lib/current-viewer";
import { publishSellerOffer } from "@/application/seller-sharing";
import { ViewerAccessError } from "@/application/viewer";
import { compareDecimalStrings } from "@/domain/decimal";
import { createClient } from "@/lib/supabase/server";
import { RepositoryError } from "@/repositories/errors";
import { decimal6Schema, uuidSchema } from "@/repositories/schemas";
import {
  createEnergyDataRepository,
  createMarketRepository,
} from "@/repositories/supabase/caller";

const positiveDecimal = decimal6Schema.refine(
  (value) => compareDecimalStrings(value, "0") > 0,
  "Enter a quantity greater than zero.",
);

const offerActionSchema = z.object({
  intervalId: uuidSchema,
  quantityKwh: positiveDecimal,
  minimumPrice: decimal6Schema,
});

export async function publishOfferAction(
  _previousState: MarketActionState,
  formData: FormData,
): Promise<MarketActionState> {
  const parsed = offerActionSchema.safeParse({
    intervalId: formData.get("intervalId"),
    quantityKwh: formData.get("quantityKwh"),
    minimumPrice: formData.get("minimumPrice"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      status: "failure",
      message: "Check the quantity and minimum price, then try again.",
      fieldErrors: {
        quantityKwh: errors.quantityKwh,
        price: errors.minimumPrice,
      },
    };
  }

  const viewer = await getCurrentViewer();
  if (!viewer) {
    return {
      status: "failure",
      message: "Your session ended. Sign in again before publishing.",
    };
  }

  const client = await createClient();
  try {
    const offer = await publishSellerOffer(
      viewer,
      {
        energyData: createEnergyDataRepository(client),
        market: createMarketRepository(client),
      },
      parsed.data,
    );
    revalidatePath("/seller");
    revalidatePath("/marketplace");
    return {
      status: "success",
      message: "Your offer is open in the community marketplace.",
      result: {
        id: offer.id,
        state: offer.status,
        quantityKwh: offer.quantityKwh,
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
