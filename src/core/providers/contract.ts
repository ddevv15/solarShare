export type ProviderSource = "live" | "cache" | "sample";

export type ProviderFailure = {
  provider: string;
  code: string;
};

export type ProviderResult<Output> = {
  value: Output;
  source: ProviderSource;
  sourceLabel: string;
  degraded: boolean;
  failures: ReadonlyArray<ProviderFailure>;
};

export interface ProviderCandidate<Input, Output> {
  readonly name: string;
  readonly source: ProviderSource;
  read(input: Input): Promise<Output>;
}

export interface ProviderAdapter<Input, Output> {
  read(input: Input): Promise<ProviderResult<Output>>;
}

export interface ProviderLogger {
  warn(
    event: "provider_fallback",
    fields: ProviderFailure & { nextSource: ProviderSource },
  ): void;
}

export class ProviderReadError extends Error {
  constructor(
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super("A provider candidate could not return validated data.", options);
    this.name = "ProviderReadError";
  }
}
