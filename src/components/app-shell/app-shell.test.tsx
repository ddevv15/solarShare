import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

describe("AppShell", () => {
  it("provides the shared landmarks and current navigation state", () => {
    const html = renderToStaticMarkup(
      <AppShell>
        <h1>Overview</h1>
      </AppShell>,
    );

    expect(html).toContain('href="#main-content"');
    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain("Overview");
  });
});
