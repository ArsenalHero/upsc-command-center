-- Keep a small indexed catalogue so setup never loads/hashes entire papers.
-- PYQ snapshots are seeded from the reviewed source bank; mock metadata follows
-- test edits automatically. Existing Aurum sessions and exclusions stay intact.
create table if not exists mock_private.aurum_question_index (
  origin text not null check(origin in ('pyq','mock')),
  source_id text not null,
  fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
  subject text not null, subjects text[] not null,
  test_id uuid references mock_private.tests(id) on delete cascade,
  question jsonb,
  primary key(origin,source_id),
  check((origin='pyq' and test_id is null and question is not null) or (origin='mock' and test_id is not null and question is null))
);
create index if not exists aurum_index_fingerprint on mock_private.aurum_question_index(fingerprint);
create index if not exists aurum_index_subjects on mock_private.aurum_question_index using gin(subjects);
create index if not exists aurum_index_test on mock_private.aurum_question_index(test_id);
create index if not exists aurum_seen_session on mock_private.aurum_seen(session_id);
alter table mock_private.aurum_question_index enable row level security;
revoke all on mock_private.aurum_question_index from public,anon,authenticated;

create or replace function mock_private.aurum_index_test() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  delete from mock_private.aurum_question_index where test_id=new.id;
  insert into mock_private.aurum_question_index(origin,source_id,fingerprint,subject,subjects,test_id)
    select 'mock',q->>'id',mock_private.aurum_fingerprint(q),mock_private.aurum_subject(q->>'subject'),
      array[mock_private.aurum_subject(q->>'subject')],new.id from jsonb_array_elements(new.questions) q;
  return new;
end;
$$;
do $index_trigger$
begin
  if not exists(select 1 from pg_trigger where tgrelid='mock_private.tests'::regclass and tgname='aurum_index_test' and not tgisinternal) then
    create trigger aurum_index_test after insert or update of questions on mock_private.tests
      for each row execute function mock_private.aurum_index_test();
  end if;
end;
$index_trigger$;
insert into mock_private.aurum_question_index(origin,source_id,fingerprint,subject,subjects,test_id)
  select 'mock',q->>'id',mock_private.aurum_fingerprint(q),mock_private.aurum_subject(q->>'subject'),
    array[mock_private.aurum_subject(q->>'subject')],t.id
  from mock_private.tests t cross join lateral jsonb_array_elements(t.questions) q
  on conflict(origin,source_id) do update set fingerprint=excluded.fingerprint,subject=excluded.subject,
    subjects=excluded.subjects,test_id=excluded.test_id;

create or replace function mock_private.aurum_index_pool(owner_id uuid)
returns table(origin text,source_id text,fingerprint text,subject text,subjects text[],test_id uuid)
language sql stable set search_path='' as $$
  select i.origin,i.source_id,i.fingerprint,i.subject,i.subjects,i.test_id
  from mock_private.aurum_question_index i left join mock_private.tests t on t.id=i.test_id
  where (i.origin='pyq' or (t.listed and t.status='active' and t.publish_at<=now()
    and (t.scheduled_at is null or t.scheduled_at<=now()) and (t.closes_at is null or t.closes_at>now())))
    and not exists(select 1 from mock_private.aurum_seen s where s.user_id=owner_id and s.fingerprint=i.fingerprint)
    and not exists(select 1 from mock_private.aurum_seen s where s.user_id=owner_id and s.origin=i.origin and s.source_id=i.source_id);
$$;
create or replace function mock_private.aurum_preview(s mock_private.aurum_sessions) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',s.id,'source',s.source,'subjects',s.subjects,'status',s.status,'startedAt',s.started_at,
    'summary',jsonb_build_object('total',jsonb_array_length(s.questions),'answered',(select count(*) from jsonb_each(s.answers)),
      'correct',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='correct'),
      'incorrect',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='incorrect'),
      'skipped',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='skipped')));
$$;

create or replace function mock_private.aurum_fast_api(op text,p jsonb,owner_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  source_n text=coalesce(p->>'source','both'); selected text[]='{}'; count_n integer;
  s mock_private.aurum_sessions; request_id uuid; qs jsonb;
begin
  if owner_id is null then raise exception 'Aurum access is required'; end if;
  if source_n not in ('pyq','mock','both') then raise exception 'Choose PYQs, mocks or both'; end if;
  if p ? 'subjects' then
    if jsonb_typeof(p->'subjects') is distinct from 'array' or jsonb_array_length(p->'subjects')>30
      or exists(select 1 from jsonb_array_elements(p->'subjects') v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 100)
      then raise exception 'Select valid subjects'; end if;
    select coalesce(array_agg(distinct mock_private.aurum_subject(value)),'{}') into selected from jsonb_array_elements_text(p->'subjects');
  end if;
  if op='aurum-catalog' then
    return (
      with pool as materialized(select * from mock_private.aurum_index_pool(owner_id)),
      names as (select distinct unnest(i.subjects) name from mock_private.aurum_question_index i
        left join mock_private.tests t on t.id=i.test_id where i.origin='pyq' or (t.listed and t.status='active' and t.publish_at<=now()
          and (t.scheduled_at is null or t.scheduled_at<=now()) and (t.closes_at is null or t.closes_at>now()))),
      facets as (select name,count(distinct fingerprint) filter(where origin='pyq') pyq,
        count(distinct fingerprint) filter(where origin='mock') mock,count(distinct fingerprint) both
        from pool cross join lateral unnest(subjects) name group by name),
      chosen as (select * from pool where cardinality(selected)=0 or subjects && selected)
      select jsonb_build_object(
        'source',source_n,'selected',selected,
        'available',(select count(distinct fingerprint) from chosen where source_n='both' or origin=source_n),
        'sources',(select jsonb_build_object('pyq',count(distinct fingerprint) filter(where origin='pyq'),
          'mock',count(distinct fingerprint) filter(where origin='mock'),'both',count(distinct fingerprint)) from chosen),
        'subjects',(select coalesce(jsonb_agg(jsonb_build_object('name',n.name,'pyq',coalesce(f.pyq,0),'mock',coalesce(f.mock,0),'both',coalesce(f.both,0)) order by n.name),'[]') from names n left join facets f using(name)),
        'active',(select mock_private.aurum_preview(x) from mock_private.aurum_sessions x where user_id=owner_id and status='running'),
        'latest',(select mock_private.aurum_preview(x) from mock_private.aurum_sessions x where user_id=owner_id and status='completed' order by started_at desc,id limit 1),
        'completed',(select count(*) from mock_private.aurum_sessions where user_id=owner_id and status='completed'),
        'practised',(select count(*) from mock_private.aurum_seen where user_id=owner_id))
    );
  end if;
  if op='aurum-start-v2' then
    perform pg_advisory_xact_lock(hashtextextended('aurum:'||owner_id::text,0));
    request_id=(p->>'requestId')::uuid;
    if request_id is null then raise exception 'A practice request ID is required'; end if;
    select * into s from mock_private.aurum_sessions where id=request_id and user_id=owner_id;
    if found then return mock_private.aurum_public(s); end if;
    select * into s from mock_private.aurum_sessions where user_id=owner_id and status='running';
    if found then return mock_private.aurum_public(s); end if;
    if cardinality(selected)=0 then raise exception 'Select one or more subjects'; end if;
    if coalesce(p->>'count','') !~ '^[0-9]{1,3}$' then raise exception 'Choose a whole number from 1 to 100'; end if;
    count_n=(p->>'count')::integer;
    if count_n not between 1 and 100 then raise exception 'Choose a whole number from 1 to 100'; end if;
    -- Work with indexed identities first. Fetch snapshots only for the chosen set.
    with pool as materialized(select * from mock_private.aurum_index_pool(owner_id)
      where (source_n='both' or origin=source_n) and subjects && selected),
    first_pyq as (select a.* from pool a where source_n='both' and count_n>=2 and a.origin='pyq'
      and exists(select 1 from pool b where b.origin='mock' and b.fingerprint<>a.fingerprint) order by random() limit 1),
    first_mock as (select b.* from pool b where b.origin='mock' and exists(select 1 from first_pyq)
      and b.fingerprint not in(select fingerprint from first_pyq) order by random() limit 1),
    priority as (select * from first_pyq union all select * from first_mock),
    remaining as (select distinct on(fingerprint) a.* from pool a
      where a.fingerprint not in(select fingerprint from priority) order by fingerprint,random()),
    rest as (select * from remaining order by random() limit greatest(0,count_n-(select count(*)::integer from priority))),
    picked as (select * from priority union all select * from rest)
    select coalesce(jsonb_agg(case when a.origin='pyq' then i.question||jsonb_build_object('subjects',i.subjects)
      else jsonb_build_object('origin','mock','sourceId',a.source_id,'testId',a.test_id) end order by random()),'[]') into qs
      from picked a join mock_private.aurum_question_index i on i.origin=a.origin and i.source_id=a.source_id;
    if jsonb_array_length(qs)<>count_n then raise exception 'There aren’t enough fresh questions. Lower the count or add subjects.'; end if;
    return mock_private.aurum_api('aurum-start',jsonb_build_object('requestId',request_id,'source',source_n,
      'subjects',selected,'count',count_n,'questions',qs),owner_id);
  end if;
  raise exception 'Unknown Aurum operation';
end;
$$;
revoke all on function mock_private.aurum_index_test(),mock_private.aurum_index_pool(uuid),
  mock_private.aurum_preview(mock_private.aurum_sessions),mock_private.aurum_fast_api(text,jsonb,uuid) from public,anon,authenticated;

do $fast_dispatch$
declare
  definition text=pg_get_functiondef('mock_private.aurum_api(text,jsonb,uuid)'::regprocedure);
  anchor text=$anchor$  if op='aurum-state' then$anchor$;
  addition text=$addition$  if op in ('aurum-catalog','aurum-start-v2') then return mock_private.aurum_fast_api(op,p,owner_id); end if;
$addition$;
begin
  if strpos(definition,addition)>0 then return; end if;
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'Unrecognized Aurum API; review before adding fast setup'; end if;
  execute replace(definition,anchor,addition||anchor);
end;
$fast_dispatch$;
