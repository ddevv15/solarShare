import { ArrowDown, Layers3, ShieldCheck, Tags } from "lucide-react";

import { FeedbackState } from "@/components/foundation/feedback-state";
import { LoadingState } from "@/components/foundation/loading-state";
import { PageHeader } from "@/components/foundation/page-header";
import { SourceLabel } from "@/components/foundation/source-label";
import { StatusLabel } from "@/components/foundation/status-label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const foundationAreas = [
  {
    title: "A steady shell",
    description:
      "The same landmarks, navigation, content width, and page rhythm can wrap every household and operator screen.",
    icon: Layers3,
  },
  {
    title: "Clear system states",
    description:
      "Loading, empty data, failure, and success have reusable patterns with the right live region behavior.",
    icon: ShieldCheck,
  },
  {
    title: "Visible provenance",
    description:
      "Provider backed values keep a compact label that says whether the result is live, cached, or a stored sample.",
    icon: Tags,
  },
] as const;

const contracts = [
  ["Forms", "Persistent labels, help text, validation, 44 pixel controls"],
  ["Tables", "Semantic headers and contained horizontal scrolling"],
  ["Status", "Text and tone together, never colour alone"],
  ["Feedback", "Actionable loading, empty, failure, and success regions"],
] as const;

export default function Home() {
  return (
    <>
      <PageHeader
        eyebrow="Foundation preview"
        title="A clear base for every energy trade"
        description="SolarShare now has the shared shell, controls, status language, and feedback patterns that later seller, buyer, and operator screens can reuse."
        action={
          <Button asChild size="lg">
            <a href="#foundation-states">
              Review the states
              <ArrowDown data-icon="inline-end" aria-hidden="true" />
            </a>
          </Button>
        }
      />

      <section
        aria-labelledby="foundation-areas-title"
        className="flex flex-col gap-5"
      >
        <div className="flex max-w-2xl flex-col gap-2">
          <h2
            id="foundation-areas-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Built to stay out of the way
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            The foundation keeps attention on energy, price, and trust while
            giving each future screen a consistent structure.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {foundationAreas.map(({ description, icon: Icon, title }) => (
            <Card key={title}>
              <CardHeader>
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section
        id="foundation-states"
        aria-labelledby="states-title"
        className="flex scroll-mt-6 flex-col gap-5"
      >
        <div className="flex max-w-2xl flex-col gap-2">
          <h2
            id="states-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Reusable feedback states
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Each state remains inside the region it replaces and tells people
            what happened in plain language.
          </p>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <LoadingState label="Loading a future market panel" />
          <FeedbackState
            state="empty"
            title="Nothing here yet"
            description="This region is ready for a future collection and can explain the first useful action when that feature arrives."
          />
          <FeedbackState
            state="failure"
            title="The data could not be loaded"
            description="Future screens can add a retry action here while keeping the rest of the shell available."
          />
          <FeedbackState
            state="success"
            title="The change was saved"
            description="A concise confirmation can sit close to the action without interrupting the next task."
          />
        </div>
      </section>

      <section
        aria-labelledby="contracts-title"
        className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]"
      >
        <Card>
          <CardHeader>
            <CardTitle id="contracts-title">
              Shared interface contracts
            </CardTitle>
            <CardDescription>
              Forms and data tables can start from the same accessible
              primitives rather than defining new behavior per feature.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Surface</TableHead>
                  <TableHead scope="col">Baseline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(([surface, baseline]) => (
                  <TableRow key={surface}>
                    <TableCell className="font-medium">{surface}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {baseline}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source and status labels</CardTitle>
            <CardDescription>
              Labels stay readable in context and do not rely on colour alone.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Provider source</p>
              <div className="flex flex-wrap gap-2">
                <SourceLabel source="live" label="Live inverter" />
                <SourceLabel source="cache" label="Recent cache" />
                <SourceLabel source="sample" label="Stored sample" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Lifecycle status</p>
              <div className="flex flex-wrap gap-2">
                <StatusLabel>Planned</StatusLabel>
                <StatusLabel tone="success">Completed</StatusLabel>
                <StatusLabel tone="warning">Needs review</StatusLabel>
                <StatusLabel tone="failure">Failed</StatusLabel>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
