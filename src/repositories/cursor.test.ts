import { describe, expect, it } from "vitest";
import { z } from "zod";

import { decodeCursor, encodeCursor, pageFromRows } from "./cursor";
import { RepositoryError } from "./errors";

const shape = { settled_at: z.string(), id: z.string() };

describe("cursor codec", () => {
  it("round trips a cursor through base64url transport", () => {
    const cursor = { settled_at: "2026-09-12T18:31:00+00:00", id: "a-uuid" };

    expect(decodeCursor(encodeCursor(cursor), shape)).toEqual(cursor);
  });

  it("encodes canonically so equal cursors produce equal strings", () => {
    const left = encodeCursor({ id: "one", settled_at: "t" });
    const right = encodeCursor({ settled_at: "t", id: "one" });

    expect(left).toBe(right);
  });

  it("produces a URL safe string with no padding", () => {
    const encoded = encodeCursor({
      settled_at: "2026-09-12T18:31:00+00:00",
      id: "a-uuid",
    });

    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns undefined for an absent cursor", () => {
    expect(decodeCursor(undefined, shape)).toBeUndefined();
  });

  it("rejects extra, missing, and mistyped keys", () => {
    const extra = encodeCursor({
      settled_at: "t",
      id: "one",
      injected: "value",
    });
    const missing = encodeCursor({ id: "one" });

    expect(() => decodeCursor(extra, shape)).toThrow(RepositoryError);
    expect(() => decodeCursor(missing, shape)).toThrow(RepositoryError);
  });

  it("reports a corrupt cursor as invalid input rather than leaking the parse error", () => {
    try {
      decodeCursor("not-a-cursor", shape);
      expect.unreachable("a corrupt cursor must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(RepositoryError);
      expect((error as RepositoryError).code).toBe("invalid_input");
    }
  });
});

describe("pageFromRows", () => {
  const row = (id: string) => ({ id, cursor: { id } });

  it("emits a next cursor only when an extra row was fetched", () => {
    const page = pageFromRows([row("a"), row("b"), row("c")], 2);

    expect(page.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe(encodeCursor({ id: "b" }));
  });

  it("ends the sequence when the page is not full", () => {
    const page = pageFromRows([row("a"), row("b")], 2);

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeUndefined();
  });

  it("ends the sequence on an empty result", () => {
    const page = pageFromRows([], 25);

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeUndefined();
  });
});
