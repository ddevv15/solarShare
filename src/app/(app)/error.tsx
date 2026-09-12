"use client";

import { RotateCcw } from "lucide-react";

import { FeedbackState } from "@/components/foundation/feedback-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <>
      <h1 className="sr-only">SolarShare view unavailable</h1>
      <FeedbackState
        state="failure"
        title="SolarShare could not load this view"
        description="The navigation is still available. Try loading this view again."
        action={
          <Button type="button" variant="outline" onClick={retry}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
        }
      />
    </>
  );
}
