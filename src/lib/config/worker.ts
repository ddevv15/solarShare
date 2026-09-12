import "server-only";

import { ConfigurationError } from "@/lib/config/errors";
import { workerEnvironmentSchema } from "@/lib/config/schema";

export type WorkerConfig = ReturnType<typeof parseWorkerConfig>;

function parseWorkerConfig(environment: NodeJS.ProcessEnv) {
  const result = workerEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new ConfigurationError("worker", result.error);
  }

  return result.data;
}

export function getWorkerConfig(): WorkerConfig {
  return parseWorkerConfig(process.env);
}
