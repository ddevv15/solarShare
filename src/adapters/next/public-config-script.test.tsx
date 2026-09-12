import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicConfigScript } from "@/adapters/next/public-config-script";

describe("PublicConfigScript", () => {
  it("serializes the public configuration into the expected script element", () => {
    const html = renderToStaticMarkup(
      <PublicConfigScript
        config={{
          supabaseUrl: "https://project.supabase.co",
          supabasePublishableKey: "sb_publishable_example",
          timezone: "Asia/Kolkata",
          currency: "INR",
        }}
      />,
    );

    expect(html).toContain('id="solarshare-public-config"');
    expect(html).toContain('type="application/json"');
    expect(html).toContain('"timezone":"Asia/Kolkata"');
    expect(html).toContain('"currency":"INR"');
  });

  it("escapes markup before placing configuration in the document", () => {
    const html = renderToStaticMarkup(
      <PublicConfigScript
        config={{
          supabaseUrl: "https://project.supabase.co",
          supabasePublishableKey: "</script><script>alert(1)</script>",
          timezone: "Asia/Kolkata",
          currency: "INR",
        }}
      />,
    );

    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain("</script><script>alert(1)</script>");
  });
});
