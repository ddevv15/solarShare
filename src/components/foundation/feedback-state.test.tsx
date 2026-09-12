import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeedbackState } from "@/components/foundation/feedback-state";
import { LoadingState } from "@/components/foundation/loading-state";

describe("foundation feedback states", () => {
  it("renders an empty state with an explicit state marker", () => {
    const html = renderToStaticMarkup(
      <FeedbackState
        state="empty"
        title="No offers"
        description="Published offers will appear here."
      />,
    );

    expect(html).toContain('data-state="empty"');
    expect(html).toContain("No offers");
    expect(html).toContain("Published offers will appear here.");
  });

  it("announces failures urgently and success politely", () => {
    const failure = renderToStaticMarkup(
      <FeedbackState
        state="failure"
        title="Could not load"
        description="Try again."
      />,
    );
    const success = renderToStaticMarkup(
      <FeedbackState
        state="success"
        title="Saved"
        description="The change is complete."
      />,
    );

    expect(failure).toContain('role="alert"');
    expect(success).toContain('role="status"');
  });

  it("marks loading regions busy and gives them an accessible label", () => {
    const html = renderToStaticMarkup(
      <LoadingState label="Loading marketplace" />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading marketplace"');
  });
});
