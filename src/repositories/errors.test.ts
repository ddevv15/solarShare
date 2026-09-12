import { describe, expect, it } from "vitest";

import { mapDatabaseError, RepositoryError, unwrap } from "./errors";

describe("mapDatabaseError", () => {
  it.each([
    ["42501", "forbidden"],
    ["23505", "conflict"],
    ["40001", "conflict"],
    ["55000", "invalid_state"],
    ["22P02", "invalid_input"],
    ["23514", "invalid_input"],
    ["PGRST116", "not_found"],
  ])("maps SQLSTATE %s to %s", (code, expected) => {
    expect(mapDatabaseError({ code }).code).toBe(expected);
  });

  it("treats an unrecognised failure as unavailable and keeps the cause", () => {
    const source = { code: "XX000", message: "internal" };
    const mapped = mapDatabaseError(source);

    expect(mapped.code).toBe("unavailable");
    expect(mapped.cause).toBe(source);
  });

  it("never leaks the raw database message to the caller", () => {
    const mapped = mapDatabaseError({
      code: "42501",
      message: 'permission denied for table "ledger_entries"',
    });

    expect(mapped.message).not.toContain("ledger_entries");
  });
});

describe("unwrap", () => {
  it("returns data when the call succeeded", () => {
    expect(unwrap({ data: { id: "one" }, error: null })).toEqual({ id: "one" });
  });

  it("throws the mapped error when the call failed", () => {
    expect(() => unwrap({ data: null, error: { code: "42501" } })).toThrow(
      RepositoryError,
    );
  });

  it("treats an absent row as not found", () => {
    try {
      unwrap({ data: null, error: null });
      expect.unreachable("a missing row must throw");
    } catch (error) {
      expect((error as RepositoryError).code).toBe("not_found");
    }
  });
});
