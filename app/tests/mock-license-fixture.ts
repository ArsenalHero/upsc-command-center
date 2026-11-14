import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";

// Deliberately unrelated to the privately configured production license.
export const fixtureLicense = "fixture-mock-license";
export async function prepareMockDatabase(db: PGlite, users: { id: string; admin?: boolean }[]) {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated;
  `);
  for (const user of users) {
    await db.query("insert into auth.users values($1,now(),false,$2::jsonb)", [user.id, JSON.stringify({ mock_admin: !!user.admin })]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$1)", [user.id]);
  }
  await db.exec(readFileSync(new URL("../supabase/sql/mock-lab.sql", import.meta.url), "utf8"));
  await db.query(`insert into mock_private.license_config(key_salt,key_hash)
    select salt,sha256(salt||convert_to($1,'UTF8')) from (select sha256(convert_to('isolated test salt','UTF8')) salt) s`, [fixtureLicense]);
}
export async function setMockUser(db: PGlite, user: string | null, sessionId = user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [user || "", JSON.stringify(user ? { sub: user, session_id: sessionId } : {})]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
}
