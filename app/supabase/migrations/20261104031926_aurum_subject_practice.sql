-- Aurum reuses Golden Gate's checked account/guest identity and license gate.
-- Sessions and their permanent reservations are separate from ranked mocks.
create table if not exists mock_private.aurum_sessions (
  id uuid primary key,
  user_id uuid not null references mock_private.participants(id) on delete cascade,
  source text not null check(source in ('pyq','mock','both')),
  subjects text[] not null,
  status text not null default 'running' check(status in ('running','completed')),
  questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 100),
  answers jsonb not null default '{}',
  started_at timestamptz not null default now(), completed_at timestamptz
);
create unique index if not exists aurum_one_running on mock_private.aurum_sessions(user_id) where status='running';
create index if not exists aurum_history on mock_private.aurum_sessions(user_id,started_at desc);
create table if not exists mock_private.aurum_seen (
  user_id uuid not null references mock_private.participants(id) on delete cascade,
  fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
  origin text not null check(origin in ('pyq','mock')), source_id text not null,
  session_id uuid not null references mock_private.aurum_sessions(id) on delete cascade,
  primary key(user_id,fingerprint)
);
create unique index if not exists aurum_seen_source on mock_private.aurum_seen(user_id,origin,source_id);
alter table mock_private.aurum_sessions enable row level security;
alter table mock_private.aurum_seen enable row level security;
revoke all on mock_private.aurum_sessions,mock_private.aurum_seen from public,anon,authenticated;

create or replace function mock_private.aurum_subject(s text) returns text
language sql immutable set search_path='' as $$
  select case lower(trim(s)) when 'economics' then 'Economy'
    when 'polity & governance' then 'Polity' when 'art and culture' then 'Art & Culture'
    when 'science and technology' then 'Science & Technology' when 'science and tech' then 'Science & Technology'
    else trim(s) end;
$$;
create or replace function mock_private.aurum_fingerprint(q jsonb) returns text
language sql immutable set search_path='' as $$
  select encode(sha256(convert_to(
    regexp_replace(lower(q->>'question'),'[^a-z0-9]','','g')||'|'||
    (select string_agg(v,'|' order by v collate "C") from
      (select regexp_replace(lower(value),'[^a-z0-9]','','g') v from jsonb_each_text(q->'options')) o),
    'UTF8')),'hex');
$$;
create or replace function mock_private.aurum_mocks(owner_id uuid)
returns table(fingerprint text,question jsonb,test_id uuid,source_label text)
language sql stable set search_path='' as $$
  select distinct on (fp) fp,q,tid,label from (
    select mock_private.aurum_fingerprint(q) fp,q,t.id tid,t.name label
    from mock_private.tests t cross join lateral jsonb_array_elements(t.questions) q
    where t.listed and t.status='active' and t.publish_at<=now()
      and (t.scheduled_at is null or t.scheduled_at<=now()) and (t.closes_at is null or t.closes_at>now())
  ) pool where not exists(select 1 from mock_private.aurum_seen s where s.user_id=owner_id and
    (s.fingerprint=fp or (s.origin='mock' and s.source_id=q->>'id')))
  order by fp,tid;
$$;
create or replace function mock_private.aurum_public(s mock_private.aurum_sessions) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',s.id,'source',s.source,'subjects',s.subjects,'status',s.status,
    'startedAt',s.started_at,'completedAt',s.completed_at,'answers',s.answers,
    'questions',(select jsonb_agg(case when s.answers ? (q->>'id') then q else q-'correct'-'explanation' end order by n)
      from jsonb_array_elements(s.questions) with ordinality x(q,n)),
    'summary',jsonb_build_object('total',jsonb_array_length(s.questions),
      'answered',(select count(*) from jsonb_each(s.answers)),
      'correct',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='correct'),
      'incorrect',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='incorrect'),
      'skipped',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='skipped')));
$$;

-- Invoked only by mock_private.api after its existing session/license checks.
-- It has no client EXECUTE grant and never accepts an owner supplied by a client.
create or replace function mock_private.aurum_api(op text,p jsonb,owner_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  s mock_private.aurum_sessions; q jsonb; item jsonb; qs jsonb='[]';
  subjects_n text[]; source_n text; fp text; option_n text; id_n text;
  n integer; requested integer; request_id uuid;
begin
  if owner_id is null then raise exception 'Aurum access is required'; end if;
  if op='aurum-state' then
    return jsonb_build_object(
      'seen',(select coalesce(jsonb_agg(fingerprint),'[]') from mock_private.aurum_seen where user_id=owner_id),
      'seenIds',(select coalesce(jsonb_agg('id:'||origin||':'||source_id),'[]') from mock_private.aurum_seen where user_id=owner_id),
      'mocks',(select coalesce(jsonb_agg(jsonb_build_object('origin','mock','sourceId',question->>'id',
        'testId',test_id,'fingerprint',fingerprint,'subject',mock_private.aurum_subject(question->>'subject'),
        'subjects',jsonb_build_array(mock_private.aurum_subject(question->>'subject')),'sourceLabel',source_label)),'[]')
        from mock_private.aurum_mocks(owner_id)),
      'active',(select mock_private.aurum_public(x) from mock_private.aurum_sessions x where user_id=owner_id and status='running'),
      'latest',(select mock_private.aurum_public(x) from mock_private.aurum_sessions x where user_id=owner_id and status='completed' order by started_at desc,id limit 1),
      'completed',(select count(*) from mock_private.aurum_sessions where user_id=owner_id and status='completed'),
      'practised',(select count(*) from mock_private.aurum_seen where user_id=owner_id));
  end if;
  if op='aurum-start' then
    -- Serialize starts across tabs/devices, including retries after a lost reply.
    perform pg_advisory_xact_lock(hashtextextended('aurum:'||owner_id::text,0));
    request_id=(p->>'requestId')::uuid;
    if request_id is null then raise exception 'A practice request ID is required'; end if;
    select * into s from mock_private.aurum_sessions where id=request_id and user_id=owner_id;
    if found then return mock_private.aurum_public(s); end if;
    select * into s from mock_private.aurum_sessions where user_id=owner_id and status='running';
    if found then return mock_private.aurum_public(s); end if;
    source_n=p->>'source';
    if source_n is null or source_n not in ('pyq','mock','both') then raise exception 'Choose PYQs, mocks or both'; end if;
    if jsonb_typeof(p->'subjects') is distinct from 'array' or jsonb_array_length(p->'subjects') not between 1 and 30
      or exists(select 1 from jsonb_array_elements(p->'subjects') v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 100)
      then raise exception 'Select one or more subjects'; end if;
    select array_agg(distinct mock_private.aurum_subject(value)) into subjects_n from jsonb_array_elements_text(p->'subjects');
    if coalesce(p->>'count','') !~ '^[0-9]{1,3}$' then raise exception 'Choose a whole number from 1 to 100'; end if;
    requested=(p->>'count')::integer;
    if requested not between 1 and 100 or jsonb_typeof(p->'questions') is distinct from 'array'
      then raise exception 'Choose 1–100 fresh questions'; end if;
    n=jsonb_array_length(p->'questions');
    if n<>requested or octet_length(p::text)>2000000 then raise exception 'Question count does not match the practice set'; end if;
    for item in select value from jsonb_array_elements(p->'questions') loop
      if item->>'origin'='mock' and source_n in ('mock','both') then
        select v||jsonb_build_object('origin','mock','sourceId',v->>'id','testId',t.id,'sourceLabel',t.name)
          into q from mock_private.tests t cross join lateral jsonb_array_elements(t.questions) v
          where t.id=(item->>'testId')::uuid and v->>'id'=item->>'sourceId'
            and t.listed and t.status='active' and t.publish_at<=now()
            and (t.scheduled_at is null or t.scheduled_at<=now()) and (t.closes_at is null or t.closes_at>now());
        if q is null then raise exception 'Fresh questions changed. Refresh and choose another set.'; end if;
      elsif item->>'origin'='pyq' and source_n in ('pyq','both') then
        -- PYQ wording/keys already ship in the public reviewed bank. Their
        -- snapshots are used only in unranked Aurum, never for mock rankings.
        q=item-'subjects';
        if length(coalesce(q->>'sourceId','')) not between 1 and 200 or length(coalesce(q->>'question','')) not between 8 and 30000
          or jsonb_typeof(q->'options') is distinct from 'object' then raise exception 'Invalid PYQ question'; end if;
        if (select count(*) from jsonb_object_keys(q->'options')) not between 2 and 5
          or coalesce(q->>'correct','')='' or not(q->'options' ? (q->>'correct'))
          or exists(select 1 from jsonb_each(q->'options') x where jsonb_typeof(x.value)<>'string' or length(x.value#>>'{}') not between 1 and 10000)
          then raise exception 'A valid answer key and choices are required'; end if;
      else raise exception 'Question source does not match your selection'; end if;
      if not coalesce((mock_private.aurum_subject(q->>'subject')=any(subjects_n)) or (
        item->>'origin'='pyq' and jsonb_typeof(item->'subjects')='array' and exists(
          select 1 from jsonb_array_elements_text(item->'subjects') v where mock_private.aurum_subject(v)=any(subjects_n))),false)
        then raise exception 'Question subject does not match your selection'; end if;
      fp=mock_private.aurum_fingerprint(q);
      if exists(select 1 from mock_private.aurum_seen where user_id=owner_id and
        (fingerprint=fp or (origin=q->>'origin' and source_id=q->>'sourceId')))
        or exists(select 1 from jsonb_array_elements(qs) v where v->>'fingerprint'=fp or
          (v->>'origin'=q->>'origin' and v->>'sourceId'=q->>'sourceId'))
        then raise exception 'This question was already used. Refresh to get fresh questions.'; end if;
      q=q||jsonb_build_object('id',gen_random_uuid(),'fingerprint',fp,'subject',mock_private.aurum_subject(q->>'subject'));
      qs=qs||jsonb_build_array(q);
    end loop;
    insert into mock_private.aurum_sessions(id,user_id,source,subjects,questions)
      values(request_id,owner_id,source_n,subjects_n,qs) returning * into s;
    -- Reserve every question before returning it. Abandoned/skipped questions
    -- remain excluded; exhausted pools never reset or recycle automatically.
    insert into mock_private.aurum_seen(user_id,fingerprint,origin,source_id,session_id)
      select owner_id,v->>'fingerprint',v->>'origin',v->>'sourceId',s.id from jsonb_array_elements(qs) v;
    return mock_private.aurum_public(s);
  end if;
  if op in ('aurum-session','aurum-answer','aurum-finish') then
    select * into s from mock_private.aurum_sessions where id=(p->>'sessionId')::uuid and user_id=owner_id for update;
    if not found then raise exception 'Practice session not found'; end if;
    if op='aurum-answer' and s.status='running' then
      id_n=p->>'questionId';
      select value into q from jsonb_array_elements(s.questions) where value->>'id'=id_n;
      if q is null then raise exception 'Question not found in this practice set'; end if;
      if not(s.answers ? id_n) then
        option_n=coalesce(p->>'option','');
        if option_n<>'' and not(q->'options' ? option_n) then raise exception 'Choose a valid answer'; end if;
        s.answers=s.answers||jsonb_build_object(id_n,jsonb_build_object('option',option_n,'outcome',
          case when option_n='' then 'skipped' when option_n=q->>'correct' then 'correct' else 'incorrect' end));
      end if;
    end if;
    if op='aurum-finish' and s.status='running' then
      for q in select value from jsonb_array_elements(s.questions) loop
        if not(s.answers ? (q->>'id')) then s.answers=s.answers||jsonb_build_object(q->>'id',jsonb_build_object('option','','outcome','skipped')); end if;
      end loop;
    end if;
    if op<>'aurum-session' and s.status='running' then
      if (select count(*) from jsonb_each(s.answers))=jsonb_array_length(s.questions) then
        s.status='completed'; s.completed_at=clock_timestamp();
      end if;
      update mock_private.aurum_sessions set answers=s.answers,status=s.status,completed_at=s.completed_at where id=s.id;
    end if;
    return mock_private.aurum_public(s);
  end if;
  raise exception 'Unknown Aurum operation';
end;
$$;
revoke all on function mock_private.aurum_subject(text),mock_private.aurum_fingerprint(jsonb),
  mock_private.aurum_mocks(uuid),mock_private.aurum_public(mock_private.aurum_sessions),
  mock_private.aurum_api(text,jsonb,uuid) from public,anon,authenticated;

-- Fail closed if the surrounding API differs; never weaken the existing gate.
do $aurum_dispatch$
declare
  definition text=pg_get_functiondef('mock_private.api(text,jsonb)'::regprocedure);
  anchor text=$anchor$ if not authorized then raise exception 'License verification is required to access Mock Tests' using errcode='PT403'; end if;$anchor$;
  addition text=$addition$
 if op like 'aurum-%' then return mock_private.aurum_api(op,p,u); end if;$addition$;
begin
  if strpos(definition,addition)>0 then return; end if;
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception 'Unrecognized mock API; review before adding Aurum';
  end if;
  execute replace(definition,anchor,anchor||addition);
end;
$aurum_dispatch$;
