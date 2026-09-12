export type RepositoryErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_state"
  | "invalid_input"
  | "unavailable";

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RepositoryError";
  }
}

export function mapDatabaseError(error: {
  code?: string;
  message?: string;
}): RepositoryError {
  const code = error.code ?? "";
  if (code === "42501")
    return new RepositoryError(
      "forbidden",
      "You do not have access to that record.",
    );
  if (code === "23505" || code === "40001")
    return new RepositoryError(
      "conflict",
      "The record changed or already exists.",
    );
  if (code === "55000")
    return new RepositoryError(
      "invalid_state",
      "That change is not valid in the current state.",
    );
  if (code.startsWith("22") || code.startsWith("23"))
    return new RepositoryError(
      "invalid_input",
      "The supplied data is invalid.",
    );
  if (code === "PGRST116")
    return new RepositoryError("not_found", "The record was not found.");
  return new RepositoryError(
    "unavailable",
    "The data service is unavailable.",
    { cause: error },
  );
}

export function unwrap<T>(result: {
  data: T | null;
  error: { code?: string; message?: string } | null;
}): T {
  if (result.error) throw mapDatabaseError(result.error);
  if (result.data === null)
    throw new RepositoryError("not_found", "The record was not found.");
  return result.data;
}
