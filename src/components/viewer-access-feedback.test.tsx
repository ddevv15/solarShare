import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ViewerAccessFeedback } from "@/components/viewer-access-feedback";

describe("ViewerAccessFeedback", () => {
  it("explains the access failure and provides a named sign out control", () => {
    const html = renderToStaticMarkup(
      <ViewerAccessFeedback
        reason="This account does not have an active community membership."
        signOutAction={async () => ({ error: null })}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Community access unavailable");
    expect(html).toContain(
      "This account does not have an active community membership.",
    );
    expect(html).toContain("Sign out");
    expect(html).toContain("<form");
    expect(html).toContain('type="submit"');
  });
});
