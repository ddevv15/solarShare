import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading content" }: LoadingStateProps) {
  return (
    <Card role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-4/5" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-28" />
      </CardContent>
    </Card>
  );
}
