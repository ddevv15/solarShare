import { encodeCursor, pageFromRows } from "../cursor";
import type { Page } from "../domain";
import { RepositoryError } from "../errors";

/** Spec 0002: every list function caps `p_limit` at 100. */
export const MAX_PAGE_LIMIT = 100;

/**
 * Decode a transport cursor back into the flat object the database expects.
 * The read functions reject missing, extra, or mistyped keys themselves, and a
 * cursor never carries authorization, so shape checking stays in PostgreSQL.
 */
export function decodeCursorJson(
  cursor: string | undefined,
): Record<string, string> | undefined {
  if (!cursor) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new RepositoryError(
      "invalid_input",
      "The pagination cursor is invalid.",
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RepositoryError(
      "invalid_input",
      "The pagination cursor is invalid.",
    );
  }

  return parsed as Record<string, string>;
}

/**
 * Fetch one row beyond the page to learn whether another page exists. At the
 * database ceiling that extra row cannot be requested, so a full page yields a
 * cursor optimistically and the following page may come back empty.
 */
export async function paginate<T>(
  limit: number,
  fetchRows: (probe: number) => Promise<unknown[]>,
  map: (row: unknown) => T,
  cursorOf: (item: T) => Record<string, string>,
): Promise<Page<T>> {
  const probe = Math.min(limit + 1, MAX_PAGE_LIMIT);
  const rows = (await fetchRows(probe)).map(map);

  if (probe > limit) {
    const page = pageFromRows(
      rows.map((item) => ({ item, cursor: cursorOf(item) })),
      limit,
    );
    return {
      items: page.items.map((entry) => entry.item),
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
  }

  const last = rows.at(-1);
  return rows.length === probe && last
    ? { items: rows, nextCursor: encodeCursor(cursorOf(last)) }
    : { items: rows };
}
