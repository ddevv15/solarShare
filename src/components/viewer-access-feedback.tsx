import { LogOut } from "lucide-react";

import { FeedbackState } from "@/components/foundation/feedback-state";
import { Button } from "@/components/ui/button";

type ViewerAccessFeedbackProps = {
  reason: string;
  signOutAction: () => Promise<void>;
};

export function ViewerAccessFeedback({
  reason,
  signOutAction,
}: ViewerAccessFeedbackProps) {
  return (
    <FeedbackState
      state="failure"
      title="Community access unavailable"
      description={`${reason} Sign out, then ask the demo administrator to correct the account before trying again.`}
      action={
        <form action={signOutAction}>
          <Button type="submit">
            <LogOut data-icon="inline-start" aria-hidden="true" />
            Sign out
          </Button>
        </form>
      }
    />
  );
}
