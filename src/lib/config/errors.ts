import { ZodError } from "zod";

export class ConfigurationError extends Error {
  readonly code = "INVALID_APPLICATION_CONFIGURATION";

  constructor(runtime: "web" | "worker", error: ZodError) {
    const details = error.issues
      .map(
        (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
      )
      .join("; ");

    super(`SolarShare ${runtime} configuration is invalid. ${details}`);
    this.name = "ConfigurationError";
  }
}
