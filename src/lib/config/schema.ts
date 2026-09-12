import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const environmentBoolean = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean());

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
  APP_TIMEZONE: z.string().trim().min(1).default("Asia/Kolkata"),
  APP_CURRENCY: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("INR"),
});

export const webEnvironmentSchema = publicEnvironmentSchema
  .extend({
    APP_ORIGIN: z.url(),
    APP_ENV: z.enum(["local", "test", "preview", "production"]),
    DEMO_SEED: z.string().trim().min(1).default("solarshare-demo-v1"),
    TASKS_ENABLED: environmentBoolean,
    SUPABASE_URL: optionalUrl,
    SUPABASE_SECRET_KEY: optionalString,
    SOLARSHARE_DEMO_PASSWORD: optionalString,
    TRIGGER_PROJECT_REF: optionalString,
    TRIGGER_SECRET_KEY: optionalString,
    OPEN_METEO_BASE_URL: optionalUrl,
    OPEN_METEO_API_KEY: optionalString,
    PVGIS_BASE_URL: optionalUrl,
    PVGIS_API_KEY: optionalString,
    GEOCODING_BASE_URL: optionalUrl,
    GEOCODING_API_KEY: optionalString,
    INTERNAL_JOB_SECRET: optionalString,
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    OTEL_EXPORTER_OTLP_HEADERS: optionalString,
    OTEL_SERVICE_NAME: z.string().trim().min(1).default("solarshare-web"),
  })
  .superRefine((environment, context) => {
    if (
      environment.APP_ENV === "production" &&
      environment.SOLARSHARE_DEMO_PASSWORD
    ) {
      context.addIssue({
        code: "custom",
        message: "SOLARSHARE_DEMO_PASSWORD is not allowed in production",
        path: ["SOLARSHARE_DEMO_PASSWORD"],
      });
    }

    if (environment.TASKS_ENABLED && !environment.TRIGGER_SECRET_KEY) {
      context.addIssue({
        code: "custom",
        message: "TRIGGER_SECRET_KEY is required when TASKS_ENABLED is true",
        path: ["TRIGGER_SECRET_KEY"],
      });
    }
  });

export const workerEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(["local", "test", "preview", "production"]),
    APP_TIMEZONE: z.string().trim().min(1).default("Asia/Kolkata"),
    APP_CURRENCY: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("INR"),
    DEMO_SEED: z.string().trim().min(1).default("solarshare-demo-v1"),
    TASKS_ENABLED: environmentBoolean,
    SUPABASE_URL: optionalUrl,
    SUPABASE_SECRET_KEY: optionalString,
    SOLARSHARE_DEMO_PASSWORD: optionalString,
    TRIGGER_PROJECT_REF: optionalString,
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    OTEL_EXPORTER_OTLP_HEADERS: optionalString,
    OTEL_SERVICE_NAME: z.string().trim().min(1).default("solarshare-tasks"),
  })
  .superRefine((environment, context) => {
    if (
      environment.APP_ENV === "production" &&
      environment.SOLARSHARE_DEMO_PASSWORD
    ) {
      context.addIssue({
        code: "custom",
        message: "SOLARSHARE_DEMO_PASSWORD is not allowed in production",
        path: ["SOLARSHARE_DEMO_PASSWORD"],
      });
    }

    if (!environment.TASKS_ENABLED) {
      return;
    }

    const requiredValues = [
      "SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "TRIGGER_PROJECT_REF",
    ] as const;

    for (const name of requiredValues) {
      if (!environment[name]) {
        context.addIssue({
          code: "custom",
          message: `${name} is required when TASKS_ENABLED is true`,
          path: [name],
        });
      }
    }
  });
