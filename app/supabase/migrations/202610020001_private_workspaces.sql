-- One private, versioned study workspace per authenticated user.
create table public.study_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint workspace_shape check (
    jsonb_typeof(payload) = 'object'
    and payload ?& array['schemaVersion', 'settings', 'sessions']
    and payload->>'schemaVersion' = '1'
    and jsonb_typeof(payload->'settings') = 'object'
    and jsonb_typeof(payload->'sessions') = 'array'
  ),
  constraint workspace_size check (octet_length(payload::text) <= 8388608)
);
alter table public.study_workspaces enable row level security;
revoke all on public.study_workspaces from public, anon, authenticated;
grant select on public.study_workspaces to authenticated;
create policy "Read own study workspace" on public.study_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);

-- Keep the privileged implementation outside the schemas exposed by the API.
create schema workspace_private;
revoke all on schema workspace_private from public, anon;
grant usage on schema workspace_private to authenticated;

-- This writer takes no user_id from the caller, binds ownership to the verified
-- JWT, and rejects stale revisions. Direct table writes remain revoked.
create function workspace_private.save_study_workspace(p_payload jsonb, p_expected_revision bigint)
returns table (revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved_revision bigint;
  saved_at timestamptz;
begin
  if owner_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid_revision' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.study_workspaces as w (user_id, payload, revision, updated_at)
      values (owner_id, p_payload, 1, now())
      on conflict (user_id) do nothing
      returning w.revision, w.updated_at into saved_revision, saved_at;
  else
    update public.study_workspaces as w
      set payload = p_payload, revision = w.revision + 1, updated_at = now()
      where w.user_id = owner_id and w.revision = p_expected_revision
      returning w.revision, w.updated_at into saved_revision, saved_at;
  end if;
  if saved_revision is null then
    raise exception 'workspace_conflict' using errcode = 'P0001';
  end if;
  return query select saved_revision, saved_at;
end;
$$;
revoke all on function workspace_private.save_study_workspace(jsonb, bigint) from public, anon;
grant execute on function workspace_private.save_study_workspace(jsonb, bigint) to authenticated;

-- The browser RPC runs with the caller's privileges and delegates to the
-- authenticated-only implementation. The private schema is not API-exposed.
create function public.save_study_workspace(p_payload jsonb, p_expected_revision bigint)
returns table (revision bigint, updated_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from workspace_private.save_study_workspace(p_payload, p_expected_revision);
$$;
revoke all on function public.save_study_workspace(jsonb, bigint) from public, anon;
grant execute on function public.save_study_workspace(jsonb, bigint) to authenticated;
