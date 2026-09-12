import type { SignOutAction } from "@/app/(app)/_lib/sign-out-state";
import { SignOutForm } from "@/components/app-shell/sign-out-form";
import { FeedbackState } from "@/components/foundation/feedback-state";

type ViewerAccessFeedbackProps = {
  reason: string;
  signOutAction: SignOutAction;
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
      action={<SignOutForm action={signOutAction} />}
    />
  );
}
