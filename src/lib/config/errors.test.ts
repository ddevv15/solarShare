import { z } from "zod";
import { describe, expect, it } from "vitest";

import { ConfigurationError } from "@/lib/config/errors";

describe("ConfigurationError", () => {
  it("reports field names without including rejected secret values", () => {
    const schema = z.object({ SUPABASE_SECRET_KEY: z.string().min(20) });
    const result = schema.safeParse({ SUPABASE_SECRET_KEY: "private-value" });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("The test input must remain invalid.");
    }

    const error = new ConfigurationError("worker", result.error);

    expect(error.code).toBe("INVALID_APPLICATION_CONFIGURATION");
    expect(error.message).toContain(
      "SolarShare worker configuration is invalid",
    );
    expect(error.message).toContain("SUPABASE_SECRET_KEY");
    expect(error.message).not.toContain("private-value");
  });
});
