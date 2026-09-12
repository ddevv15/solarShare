import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="grid gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="flex max-w-3xl flex-col items-start gap-4">
        {eyebrow ? <Badge variant="secondary">{eyebrow}</Badge> : null}
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
        </div>
      </div>
      {action ? <div className="flex items-center">{action}</div> : null}
    </header>
  );
}
