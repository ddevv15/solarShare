import { Archive, Cloud, Database, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ProviderSource } from "@/core/providers/contract";
import { cn } from "@/lib/utils";

type SourceLabelProps = {
  source: ProviderSource;
  label: string;
  degraded?: boolean;
  className?: string;
};

const sourcePresentation: Record<
  ProviderSource,
  { Icon: LucideIcon; description: string }
> = {
  live: { Icon: Cloud, description: "Live source" },
  cache: { Icon: Database, description: "Cached source" },
  sample: { Icon: Archive, description: "Stored sample source" },
};

export function SourceLabel({
  source,
  label,
  degraded = source !== "live",
  className,
}: SourceLabelProps) {
  const { Icon, description } = sourcePresentation[source];

  return (
    <Badge
      variant={degraded ? "secondary" : "outline"}
      data-source={source}
      aria-label={`${label}. ${description}${degraded ? ". Fallback data" : ""}`}
      className={cn(className)}
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
