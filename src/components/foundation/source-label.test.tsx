import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SourceLabel } from "@/components/foundation/source-label";

describe("SourceLabel", () => {
  it("keeps the provider label and source kind visible", () => {
    const html = renderToStaticMarkup(
      <SourceLabel source="sample" label="Stored solar sample" />,
    );

    expect(html).toContain('data-source="sample"');
    expect(html).toContain("Stored solar sample");
    expect(html).toContain("Stored sample source. Fallback data");
  });

  it("does not describe live data as fallback data", () => {
    const html = renderToStaticMarkup(
      <SourceLabel source="live" label="Live inverter" />,
    );

    expect(html).toContain("Live source");
    expect(html).not.toContain("Fallback data");
  });
});
