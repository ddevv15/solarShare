import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

type StatusTone = "neutral" | "success" | "warning" | "failure";

type StatusLabelProps = {
  children: ReactNode;
  tone?: StatusTone;
};

const statusVariant = {
  neutral: "secondary",
  success: "success",
  warning: "warning",
  failure: "destructive",
} as const;

export function StatusLabel({ children, tone = "neutral" }: StatusLabelProps) {
  return (
    <Badge variant={statusVariant[tone]} data-tone={tone}>
      {children}
    </Badge>
  );
}
