import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migrationsDirectory = new URL(
  "../../supabase/migrations/",
  import.meta.url,
);

const read = (file: string) =>
  readFileSync(new URL(file, migrationsDirectory), "utf8");

const foundation = read("202609120001_data_access_model.sql");
const repair = read("202609120002_auth_repair_and_default_privileges.sql");
const seed = readFileSync(
  new URL("../../supabase/seed.sql", import.meta.url),
  "utf8",
);

describe("default function privileges", () => {
  // Postgres grants execute to PUBLIC on every new function, so the
  // revoke-then-grant pattern in the foundation migration only protects objects
  // that already exist. Without these, a later migration silently reintroduces
  // a function anyone can call.
  it("denies execution by default in both application schemas", () => {
    expect(repair).toContain(
      "alter default privileges in schema public\n  revoke execute on functions from public, anon, authenticated, service_role;",
    );
    expect(repair).toContain(
      "alter default privileges in schema private\n  revoke execute on functions from public, anon, authenticated, service_role;",
    );
  });

  it("keeps the hardening out of the already applied foundation migration", () => {
    // 202609120001 is applied to the hosted project. Editing it would leave the
    // file and the database permanently disagreeing, because db push skips a
    // migration it has already recorded.
    expect(foundation).not.toContain("alter default privileges");
  });
});

describe("seeded auth identities", () => {
  const tokenColumns = [
    "confirmation_token",
    "recovery_token",
    "email_change",
    "email_change_token_new",
    "email_change_token_current",
    "phone_change",
    "phone_change_token",
    "reauthentication_token",
  ];

  // Auth scans these into non-nullable strings. A null makes every Auth query
  // touching the row fail: sign-in returned 500 "Database error querying
  // schema" and the admin user list returned 500 "Database error finding users".
  it.each(tokenColumns)("seeds %s rather than leaving it null", (column) => {
    expect(seed).toContain(column);
  });

  it("repairs rows that were already written with nulls", () => {
    expect(repair).toContain(
      "update auth.users set %1$I = '''' where %1$I is null",
    );
  });
});
