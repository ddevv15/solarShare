import {
  ProviderReadError,
  type ProviderAdapter,
  type ProviderCandidate,
  type ProviderFailure,
  type ProviderLogger,
  type ProviderSource,
} from "@/core/providers/contract";

type FallbackProviderOptions<Input, Output> = {
  live?: ProviderCandidate<Input, Output>;
  cache?: ProviderCandidate<Input, Output>;
  sample: ProviderCandidate<Input, Output>;
  logger: ProviderLogger;
};

function failureFrom(error: unknown, provider: string): ProviderFailure {
  return {
    provider,
    code:
      error instanceof ProviderReadError ? error.code : "PROVIDER_UNAVAILABLE",
  };
}

export function createFallbackProvider<Input, Output>({
  live,
  cache,
  sample,
  logger,
}: FallbackProviderOptions<Input, Output>): ProviderAdapter<Input, Output> {
  const candidates = [live, cache, sample].filter(
    (candidate): candidate is ProviderCandidate<Input, Output> =>
      candidate !== undefined,
  );

  return {
    async read(input) {
      const failures: ProviderFailure[] = [];

      for (const [index, candidate] of candidates.entries()) {
        try {
          const value = await candidate.read(input);

          return {
            value,
            source: candidate.source,
            sourceLabel: candidate.name,
            degraded: candidate.source !== "live",
            failures,
          };
        } catch (error) {
          const failure = failureFrom(error, candidate.name);
          const nextSource = candidates[index + 1]?.source;

          failures.push(failure);

          if (nextSource) {
            logger.warn("provider_fallback", { ...failure, nextSource });
          }
        }
      }

      throw new ProviderReadError("PROVIDER_FALLBACK_EXHAUSTED", {
        cause: failures,
      });
    },
  };
}

export type { ProviderSource };
