import { z } from "zod";

const unsignedDecimal = (scale: number) =>
  z.string().regex(new RegExp(`^(0|[1-9][0-9]*)(\\.[0-9]{1,${scale}})?$`));
const signedDecimal = (scale: number) =>
  z.string().regex(new RegExp(`^-?(0|[1-9][0-9]*)(\\.[0-9]{1,${scale}})?$`));

// Coordinates are signed and bounded. The decimal string itself is what reaches
// PostgreSQL, so the numeric comparison here only tests magnitude, well inside
// the range where a float compares exactly.
const boundedCoordinate = (limit: number) =>
  signedDecimal(6).refine(
    (value) => Math.abs(Number(value)) <= limit,
    `must be between -${limit} and ${limit}`,
  );

export const decimal6Schema = unsignedDecimal(6);
export const decimal2Schema = unsignedDecimal(2);
export const signedDecimal2Schema = signedDecimal(2);
export const latitudeSchema = boundedCoordinate(90);
export const longitudeSchema = boundedCoordinate(180);
export const uuidSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const dateSchema = z.iso.date();
export const pageRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
});

export const updateProfileInputSchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    latitudeApprox: latitudeSchema.optional(),
    longitudeApprox: longitudeSchema.optional(),
    timezone: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      (value.latitudeApprox === undefined) ===
      (value.longitudeApprox === undefined),
    "coordinates must appear together",
  );
export const createEnergyAssetInputSchema = z.object({
  communityId: uuidSchema,
  assetType: z.enum(["solar", "battery", "meter"]),
  name: z.string().trim().min(1),
  capacityKw: decimal6Schema,
  tiltDegrees: decimal6Schema.optional(),
  azimuthDegrees: decimal6Schema.optional(),
  reserveKwh: decimal6Schema,
});
export const updateEnergyAssetInputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    capacityKw: decimal6Schema.optional(),
    tiltDegrees: decimal6Schema.nullable().optional(),
    azimuthDegrees: decimal6Schema.nullable().optional(),
    reserveKwh: decimal6Schema.optional(),
    targetStatus: z.enum(["active", "inactive", "retired"]).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "at least one field is required",
  );
export const selectReadingInputSchema = z.object({
  communityId: uuidSchema,
  assetId: uuidSchema,
  intervalId: uuidSchema,
  metric: z.enum([
    "generation",
    "consumption",
    "grid_import",
    "grid_export",
    "reserve",
  ]),
});
export const selectForecastInputSchema = z.object({
  communityId: uuidSchema,
  assetId: uuidSchema,
  intervalId: uuidSchema,
  metric: z.enum(["generation", "consumption", "reserve", "surplus"]),
  asOf: timestampSchema,
});
export const createOfferInputSchema = z.object({
  communityId: uuidSchema,
  intervalId: uuidSchema,
  solarAssetId: uuidSchema,
  forecastId: uuidSchema.optional(),
  batchId: uuidSchema.optional(),
  quantityKwh: decimal6Schema,
  minimumPrice: decimal6Schema.optional(),
  isManualQuantity: z.boolean(),
  autoAdjust: z.boolean(),
});
export const submitOfferInputSchema = createOfferInputSchema.extend({
  idempotencyKey: uuidSchema,
});
export const updateOfferInputSchema = z
  .object({
    quantityKwh: decimal6Schema.optional(),
    minimumPrice: decimal6Schema.nullable().optional(),
    isManualQuantity: z.boolean().optional(),
    autoAdjust: z.boolean().optional(),
    targetStatus: z.enum(["open", "cancelled"]).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "at least one field is required",
  );
export const createReservationInputSchema = z.object({
  communityId: uuidSchema,
  intervalId: uuidSchema,
  batchId: uuidSchema.optional(),
  quantityKwh: decimal6Schema,
  maximumPrice: decimal6Schema.optional(),
  autoAdjust: z.boolean(),
});
export const submitReservationInputSchema = createReservationInputSchema.extend(
  {
    idempotencyKey: uuidSchema,
  },
);
export const updateReservationInputSchema = z
  .object({
    quantityKwh: decimal6Schema.optional(),
    maximumPrice: decimal6Schema.nullable().optional(),
    autoAdjust: z.boolean().optional(),
    targetStatus: z.enum(["active", "cancelled"]).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "at least one field is required",
  );
export const updateMembershipInputSchema = z.object({
  communityId: uuidSchema,
  userId: uuidSchema,
  memberRole: z.enum(["household", "operator"]),
  status: z.enum(["invited", "active", "suspended"]),
  requestId: z.string().trim().min(1),
});
export const appendTariffInputSchema = z.object({
  communityId: uuidSchema,
  feedInRate: decimal6Schema,
  retailRate: decimal6Schema,
  sellerMarginRatio: decimal6Schema,
  buyerDiscountRatio: decimal6Schema,
  effectiveFrom: timestampSchema,
  effectiveTo: timestampSchema.optional(),
  requestId: z.string().trim().min(1),
});
export const appendFeederSnapshotInputSchema = z.object({
  communityId: uuidSchema,
  intervalId: uuidSchema,
  capacityKw: decimal6Schema,
  loadKw: decimal6Schema,
  sourceType: z.literal("simulated"),
  scenarioKey: z.string().trim().min(1).optional(),
  sourceRecordKey: z.string().trim().min(1),
  observedAt: timestampSchema,
  requestId: z.string().trim().min(1),
});
export const transitionIntervalInputSchema = z.object({
  communityId: uuidSchema,
  intervalId: uuidSchema,
  targetStatus: z.enum(["paused", "open", "cancelled"]),
  requestId: z.string().trim().min(1),
});
export const completeOutboxInputSchema = z.object({
  eventId: uuidSchema,
  claimToken: uuidSchema,
  delivered: z.boolean(),
  errorCode: z.string().trim().min(1).optional(),
});
export const postLedgerInputSchema = z.object({
  communityId: uuidSchema,
  settlementId: uuidSchema,
  buyerAccountId: uuidSchema,
  sellerAccountId: uuidSchema,
  idempotencyKey: z.string().trim().min(1),
});
export const resetDemoInputSchema = z.object({
  communityId: uuidSchema,
  actorUserId: uuidSchema,
  idempotencyKey: z.string().trim().min(1),
  anchorDate: dateSchema.optional(),
});

export const resetDemoResultSchema = z.object({
  schemaVersion: z.literal("1"),
  communityId: uuidSchema,
  generationId: uuidSchema,
  anchorDate: dateSchema,
  counts: z.record(z.string(), z.number().int().nonnegative()),
});
export const outboxEventSchema = z.object({
  eventId: uuidSchema,
  communityId: uuidSchema,
  topic: z.string(),
  aggregateType: z.string(),
  aggregateId: uuidSchema,
  revision: z.string().regex(/^\d+$/),
  payload: z.record(z.string(), z.unknown()),
  claimToken: uuidSchema,
  claimExpiresAt: timestampSchema,
  attemptCount: z.string().regex(/^\d+$/),
  availableAt: timestampSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type CreateEnergyAssetInput = z.infer<
  typeof createEnergyAssetInputSchema
>;
export type UpdateEnergyAssetInput = z.infer<
  typeof updateEnergyAssetInputSchema
>;
export type SelectReadingInput = z.infer<typeof selectReadingInputSchema>;
export type SelectForecastInput = z.infer<typeof selectForecastInputSchema>;
export type CreateOfferInput = z.infer<typeof createOfferInputSchema>;
export type SubmitOfferInput = z.infer<typeof submitOfferInputSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferInputSchema>;
export type CreateReservationInput = z.infer<
  typeof createReservationInputSchema
>;
export type SubmitReservationInput = z.infer<
  typeof submitReservationInputSchema
>;
export type UpdateReservationInput = z.infer<
  typeof updateReservationInputSchema
>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipInputSchema>;
export type AppendTariffInput = z.infer<typeof appendTariffInputSchema>;
export type AppendFeederSnapshotInput = z.infer<
  typeof appendFeederSnapshotInputSchema
>;
export type TransitionIntervalInput = z.infer<
  typeof transitionIntervalInputSchema
>;
export type CompleteOutboxInput = z.infer<typeof completeOutboxInputSchema>;
export type PostLedgerInput = z.infer<typeof postLedgerInputSchema>;
export type ResetDemoInput = z.infer<typeof resetDemoInputSchema>;
