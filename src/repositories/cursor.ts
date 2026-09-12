import { z } from "zod";

import { RepositoryError } from "@/repositories/errors";

export function encodeCursor(cursor: Record<string, string>): string {
  const canonical = JSON.stringify(
    Object.fromEntries(
      Object.entries(cursor).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
  return Buffer.from(canonical, "utf8").toString("base64url");
}

export function decodeCursor<T extends z.ZodRawShape>(
  cursor: string | undefined,
  shape: T,
): z.infer<z.ZodObject<T>> | undefined {
  if (!cursor) return undefined;
  try {
    return z
      .object(shape)
      .strict()
      .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw new RepositoryError(
      "invalid_input",
      "The pagination cursor is invalid.",
    );
  }
}

export function pageFromRows<T extends { cursor: Record<string, string> }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor?: string } {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    ...(rows.length > limit && last
      ? { nextCursor: encodeCursor(last.cursor) }
      : {}),
  };
}
