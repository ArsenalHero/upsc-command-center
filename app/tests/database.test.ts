import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createEmptyData } from "../src/data/defaults";

test("Postgres enforces private ownership, anonymous access rejection, and stale-save protection", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610020001_private_workspaces.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("set role anon;");
    await assert.rejects(
      () => db.query("select * from public.study_workspaces"),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        db.query("select * from public.save_study_workspace($1::jsonb, 0)", [
          JSON.stringify(createEmptyData()),
        ]),
      /permission denied/,
    );
    await db.exec(
      "reset role; set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);",
    );
    const first = createEmptyData();
    first.settings.optional = "Alice";
    assert.equal(
      (
        await db.query<{ revision: number }>(
          "select * from public.save_study_workspace($1::jsonb, 0)",
          [JSON.stringify(first)],
        )
      ).rows[0].revision,
      1,
    );
    await assert.rejects(
      () =>
        db.query(
          "update public.study_workspaces set user_id = '22222222-2222-2222-2222-222222222222'",
        ),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        db.query("select * from public.save_study_workspace($1::jsonb, 0)", [
          JSON.stringify(first),
        ]),
      /workspace_conflict/,
    );
    await db.exec(
      "select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);",
    );
    assert.equal(
      (await db.query("select * from public.study_workspaces")).rows.length,
      0,
    );
    const second = createEmptyData();
    second.settings.optional = "Bob";
    await db.query("select * from public.save_study_workspace($1::jsonb, 0)", [
      JSON.stringify(second),
    ]);
    const visible = (
      await db.query<{ user_id: string; payload: typeof second }>(
        "select * from public.study_workspaces",
      )
    ).rows;
    assert.equal(visible.length, 1);
    assert.equal(visible[0].user_id, "22222222-2222-2222-2222-222222222222");
    assert.equal(visible[0].payload.settings.optional, "Bob");
    await db.query("select * from public.save_study_workspace($1::jsonb, 1)", [
      JSON.stringify(second),
    ]);
    await assert.rejects(
      () =>
        db.query("select * from public.save_study_workspace($1::jsonb, 1)", [
          JSON.stringify(second),
        ]),
      /workspace_conflict/,
    );
    await db.exec("select set_config('request.jwt.claim.sub', '', false);");
    assert.equal(
      (await db.query("select * from public.study_workspaces")).rows.length,
      0,
    );
    await assert.rejects(
      () =>
        db.query("select * from public.save_study_workspace($1::jsonb, 0)", [
          JSON.stringify(second),
        ]),
      /authentication_required/,
    );
    await db.exec("reset role;");
    const all = (
      await db.query<{ payload: typeof first; revision: number }>(
        "select * from public.study_workspaces order by user_id",
      )
    ).rows;
    assert.equal(all[0].payload.settings.optional, "Alice");
    assert.equal(all[0].revision, 1);
    assert.equal(all[1].revision, 2);
  } finally {
    await db.close();
  }
});
