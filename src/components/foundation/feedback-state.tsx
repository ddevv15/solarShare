import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type FeedbackStateKind = "empty" | "failure" | "success";

type FeedbackStateProps = {
  state: FeedbackStateKind;
  title: string;
  description: string;
  action?: ReactNode;
};

const alertPresentation: Record<
  Exclude<FeedbackStateKind, "empty">,
  {
    Icon: LucideIcon;
    variant: "destructive" | "success";
    role: "alert" | "status";
  }
> = {
  failure: { Icon: AlertCircle, variant: "destructive", role: "alert" },
  success: { Icon: CheckCircle2, variant: "success", role: "status" },
};

export function FeedbackState({
  state,
  title,
  description,
  action,
}: FeedbackStateProps) {
  if (state === "empty") {
    return (
      <Empty data-state="empty">
        <EmptyHeader>
          <EmptyMedia>
            <Inbox aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {action ? <EmptyContent>{action}</EmptyContent> : null}
      </Empty>
    );
  }

  const { Icon, role, variant } = alertPresentation[state];

  return (
    <Alert variant={variant} role={role} data-state={state}>
      <Icon aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        {action ? <div>{action}</div> : null}
      </AlertDescription>
    </Alert>
  );
}
