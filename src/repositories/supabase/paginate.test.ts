import { describe, expect, it } from "vitest";

import { encodeCursor } from "../cursor";
import { RepositoryError } from "../errors";
import { decodeCursorJson, MAX_PAGE_LIMIT, paginate } from "./paginate";

type Item = { id: string };

const identity = (row: unknown) => row as Item;
const byId = (item: Item) => ({ id: item.id });
const make = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({ id: `id-${index}` }));

describe("decodeCursorJson", () => {
  it("round trips a cursor written by the read functions", () => {
    expect(decodeCursorJson(encodeCursor({ id: "one" }))).toEqual({
      id: "one",
    });
  });

  it("returns undefined when no cursor was supplied", () => {
    expect(decodeCursorJson(undefined)).toBeUndefined();
  });

  it("rejects a cursor that is not an object", () => {
    const listCursor = Buffer.from(JSON.stringify(["id"]), "utf8").toString(
      "base64url",
    );

    expect(() => decodeCursorJson(listCursor)).toThrow(RepositoryError);
    expect(() => decodeCursorJson("%%%")).toThrow(RepositoryError);
  });
});

describe("paginate", () => {
  it("asks for one row beyond the page to detect a following page", async () => {
    let requested = 0;
    const page = await paginate(
      25,
      async (probe) => {
        requested = probe;
        return make(26);
      },
      identity,
      byId,
    );

    expect(requested).toBe(26);
    expect(page.items).toHaveLength(25);
    expect(page.nextCursor).toBe(encodeCursor({ id: "id-24" }));
  });

  it("ends the sequence when the extra row does not arrive", async () => {
    const page = await paginate(25, async () => make(25), identity, byId);

    expect(page.items).toHaveLength(25);
    expect(page.nextCursor).toBeUndefined();
  });

  it("never requests more than the database ceiling", async () => {
    let requested = 0;
    await paginate(
      MAX_PAGE_LIMIT,
      async (probe) => {
        requested = probe;
        return make(MAX_PAGE_LIMIT);
      },
      identity,
      byId,
    );

    // p_limit is capped at 100, so asking for 101 would be rejected outright.
    expect(requested).toBe(MAX_PAGE_LIMIT);
  });

  it("still offers a cursor at the ceiling, where no extra row can be probed", async () => {
    const page = await paginate(
      MAX_PAGE_LIMIT,
      async () => make(MAX_PAGE_LIMIT),
      identity,
      byId,
    );

    expect(page.items).toHaveLength(MAX_PAGE_LIMIT);
    expect(page.nextCursor).toBe(
      encodeCursor({ id: `id-${MAX_PAGE_LIMIT - 1}` }),
    );
  });

  it("ends the sequence at the ceiling when the page is short", async () => {
    const page = await paginate(
      MAX_PAGE_LIMIT,
      async () => make(12),
      identity,
      byId,
    );

    expect(page.items).toHaveLength(12);
    expect(page.nextCursor).toBeUndefined();
  });

  it("returns an empty page without a cursor", async () => {
    const page = await paginate(25, async () => [], identity, byId);

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeUndefined();
  });
});
