import { describe, expect, it } from "vitest";

import { PUBLIC_CONFIG_ELEMENT_ID, parsePublicAppConfig } from "./public";

describe("parsePublicAppConfig", () => {
  it("returns only the values that may be sent to the browser", () => {
    const result = parsePublicAppConfig({
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
      timezone: "Asia/Kolkata",
      currency: "INR",
      supabaseSecretKey: "must_not_escape",
      triggerSecretKey: "must_not_escape",
    });

    expect(result).toEqual({
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
      timezone: "Asia/Kolkata",
      currency: "INR",
    });
  });

  it("rejects an invalid public configuration", () => {
    expect(() =>
      parsePublicAppConfig({
        supabaseUrl: "invalid",
        supabasePublishableKey: "",
        timezone: "",
        currency: "inr",
      }),
    ).toThrow();
  });

  it("uses a stable element identifier for root layout serialization", () => {
    expect(PUBLIC_CONFIG_ELEMENT_ID).toBe("solarshare-public-config");
  });
});
