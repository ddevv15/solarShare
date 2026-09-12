-- Repair the seeded Auth identities and harden default function privileges.
--
-- The canonical seed inserts into auth.users directly and leaves GoTrue's
-- token columns null. GoTrue scans those columns into non-nullable Go strings,
-- so every query touching a seeded row fails: signing in as a seeded address
-- returned 500 "Database error querying schema" while an unknown address
-- correctly returned 400, and the admin user list returned 500 "Database error
-- finding users". The columns are repaired here because the broken rows are
-- already committed to the project; seed.sql is corrected separately so a fresh
-- seed never writes them null again.

do $$
declare
  token_column text;
  affected bigint;
begin
  foreach token_column in array array[
    'confirmation_token',
    'recovery_token',
    'email_change',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change',
    'phone_change_token',
    'reauthentication_token'
  ]
  loop
    -- GoTrue has added these columns over time, so only touch what exists.
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = token_column
    ) then
      execute format(
        'update auth.users set %1$I = '''' where %1$I is null',
        token_column
      );
      get diagnostics affected = row_count;
      if affected > 0 then
        raise notice 'auth.users.% repaired on % row(s)', token_column, affected;
      end if;
    end if;
  end loop;
end;
$$;

-- A later migration must not be able to reintroduce a function that PUBLIC may
-- execute. Postgres grants execute to PUBLIC on every new function by default,
-- so the revoke-then-grant pattern used for the objects in 202609120001 only
-- holds for objects that already exist. These statements make the default deny.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated, service_role;
