import { describe, expect, it } from "vitest";

import {
  publicEnvironmentSchema,
  webEnvironmentSchema,
  workerEnvironmentSchema,
} from "./schema";

const validWebEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_example",
  APP_ORIGIN: "http://localhost:3000",
  APP_ENV: "local",
};

describe("publicEnvironmentSchema", () => {
  it("uses the documented timezone and currency defaults", () => {
    const result = publicEnvironmentSchema.parse(validWebEnvironment);

    expect(result).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_example",
      APP_TIMEZONE: "Asia/Kolkata",
      APP_CURRENCY: "INR",
    });
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ] as const)("rejects a missing required public value named %s", (name) => {
    const environment: Partial<typeof validWebEnvironment> = {
      ...validWebEnvironment,
    };
    delete environment[name];

    const result = publicEnvironmentSchema.safeParse(environment);

    expect(result.success).toBe(false);
  });

  it("rejects an invalid public URL", () => {
    const result = publicEnvironmentSchema.safeParse({
      ...validWebEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "not a URL",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a currency that is not an uppercase ISO style code", () => {
    const result = publicEnvironmentSchema.safeParse({
      ...validWebEnvironment,
      APP_CURRENCY: "inr",
    });

    expect(result.success).toBe(false);
  });
});

describe("webEnvironmentSchema", () => {
  it("accepts the core configuration without optional provider keys", () => {
    const result = webEnvironmentSchema.parse(validWebEnvironment);

    expect(result.TASKS_ENABLED).toBe(false);
    expect(result.OPEN_METEO_API_KEY).toBeUndefined();
    expect(result.PVGIS_API_KEY).toBeUndefined();
    expect(result.GEOCODING_API_KEY).toBeUndefined();
  });

  it.each(["APP_ORIGIN", "APP_ENV"] as const)(
    "rejects a missing required server value named %s",
    (name) => {
      const environment: Partial<typeof validWebEnvironment> = {
        ...validWebEnvironment,
      };
      delete environment[name];

      const result = webEnvironmentSchema.safeParse(environment);

      expect(result.success).toBe(false);
    },
  );

  it("rejects an unknown application environment", () => {
    const result = webEnvironmentSchema.safeParse({
      ...validWebEnvironment,
      APP_ENV: "development",
    });

    expect(result.success).toBe(false);
  });

  it("requires the web dispatch secret when tasks are enabled", () => {
    const result = webEnvironmentSchema.safeParse({
      ...validWebEnvironment,
      TASKS_ENABLED: "true",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["TRIGGER_SECRET_KEY"] }),
      );
    }
  });

  it("accepts web dispatch when tasks and its secret are configured", () => {
    const result = webEnvironmentSchema.parse({
      ...validWebEnvironment,
      TASKS_ENABLED: "true",
      TRIGGER_SECRET_KEY: "tr_dev_example",
    });

    expect(result.TASKS_ENABLED).toBe(true);
    expect(result.TRIGGER_SECRET_KEY).toBe("tr_dev_example");
  });

  it("normalizes empty optional values to missing values", () => {
    const result = webEnvironmentSchema.parse({
      ...validWebEnvironment,
      OPEN_METEO_BASE_URL: "",
      OPEN_METEO_API_KEY: "",
      OTEL_EXPORTER_OTLP_ENDPOINT: "",
    });

    expect(result.OPEN_METEO_BASE_URL).toBeUndefined();
    expect(result.OPEN_METEO_API_KEY).toBeUndefined();
    expect(result.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it("rejects invalid optional provider and telemetry URLs", () => {
    const result = webEnvironmentSchema.safeParse({
      ...validWebEnvironment,
      OPEN_METEO_BASE_URL: "invalid",
      OTEL_EXPORTER_OTLP_ENDPOINT: "invalid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid task toggle instead of guessing", () => {
    const result = webEnvironmentSchema.safeParse({
      ...validWebEnvironment,
      TASKS_ENABLED: "yes",
    });

    expect(result.success).toBe(false);
  });
});

describe("workerEnvironmentSchema", () => {
  it("allows a disabled worker without privileged credentials", () => {
    const result = workerEnvironmentSchema.parse({ APP_ENV: "preview" });

    expect(result.TASKS_ENABLED).toBe(false);
    expect(result.OTEL_SERVICE_NAME).toBe("solarshare-tasks");
  });

  it("requires every worker credential when tasks are enabled", () => {
    const result = workerEnvironmentSchema.safeParse({
      APP_ENV: "production",
      TASKS_ENABLED: "true",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
        "SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "TRIGGER_PROJECT_REF",
      ]);
    }
  });

  it("accepts an enabled worker with every required credential", () => {
    const result = workerEnvironmentSchema.parse({
      APP_ENV: "production",
      TASKS_ENABLED: "true",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_example",
      TRIGGER_PROJECT_REF: "proj_example",
    });

    expect(result.TASKS_ENABLED).toBe(true);
    expect(result.SUPABASE_SECRET_KEY).toBe("sb_secret_example");
  });
});
