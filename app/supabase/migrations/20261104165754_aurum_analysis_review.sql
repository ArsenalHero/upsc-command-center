-- Compact per-question progress keeps reports independent of full snapshots.
-- Existing session/answer records remain authoritative; flags never affect scores.
create table if not exists mock_private.aurum_question_progress (
  session_id uuid not null references mock_private.aurum_sessions(id) on delete cascade,
  question_id text not null,
  user_id uuid not null references mock_private.participants(id) on delete cascade,
  fingerprint text not null, question_number integer not null,
  subject text not null, topic text not null, origin text not null check(origin in ('pyq','mock')),
  stem text not null, outcome text check(outcome in ('correct','incorrect','skipped')),
  flagged boolean not null default false,
  started_at timestamptz not null, session_status text not null,
  primary key(session_id,question_id)
);
create index if not exists aurum_progress_owner on mock_private.aurum_question_progress(user_id,started_at desc,session_id,question_number);
create index if not exists aurum_progress_outcome on mock_private.aurum_question_progress(user_id,outcome,started_at desc);
create index if not exists aurum_progress_flags on mock_private.aurum_question_progress(user_id,started_at desc) where flagged;
alter table mock_private.aurum_question_progress enable row level security;
revoke all on mock_private.aurum_question_progress from public,anon,authenticated;

create or replace function mock_private.aurum_sync_progress() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  insert into mock_private.aurum_question_progress(session_id,question_id,user_id,fingerprint,question_number,subject,topic,origin,stem,outcome,started_at,session_status)
  select new.id,q->>'id',new.user_id,coalesce(q->>'fingerprint',mock_private.aurum_fingerprint(q)),n::integer,
    coalesce(mock_private.aurum_question_subject(q),'Unlabelled'),left(coalesce(q->>'topic',''),200),
    case when q->>'origin'='mock' then 'mock' else 'pyq' end,left(q->>'question',500),
    new.answers->(q->>'id')->>'outcome',new.started_at,new.status
    from jsonb_array_elements(new.questions) with ordinality x(q,n)
  on conflict(session_id,question_id) do update set outcome=excluded.outcome,session_status=excluded.session_status
    where aurum_question_progress.outcome is distinct from excluded.outcome or aurum_question_progress.session_status is distinct from excluded.session_status;
  return new;
end;
$$;
do $progress_trigger$
begin
  if not exists(select 1 from pg_trigger where tgrelid='mock_private.aurum_sessions'::regclass and tgname='aurum_sync_progress' and not tgisinternal) then
    create trigger aurum_sync_progress after insert or update of answers,status on mock_private.aurum_sessions
      for each row execute function mock_private.aurum_sync_progress();
  end if;
end;
$progress_trigger$;
insert into mock_private.aurum_question_progress(session_id,question_id,user_id,fingerprint,question_number,subject,topic,origin,stem,outcome,started_at,session_status)
  select s.id,q->>'id',s.user_id,coalesce(q->>'fingerprint',mock_private.aurum_fingerprint(q)),n::integer,
    coalesce(mock_private.aurum_question_subject(q),'Unlabelled'),left(coalesce(q->>'topic',''),200),
    case when q->>'origin'='mock' then 'mock' else 'pyq' end,left(q->>'question',500),s.answers->(q->>'id')->>'outcome',s.started_at,s.status
  from mock_private.aurum_sessions s cross join lateral jsonb_array_elements(s.questions) with ordinality x(q,n)
  on conflict(session_id,question_id) do update set outcome=excluded.outcome,session_status=excluded.session_status;

create or replace function mock_private.aurum_public(s mock_private.aurum_sessions) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',s.id,'source',s.source,'subjects',s.subjects,'status',s.status,
    'startedAt',s.started_at,'completedAt',s.completed_at,'answers',s.answers,
    'flags',(select coalesce(jsonb_agg(question_id order by question_number),'[]') from mock_private.aurum_question_progress where session_id=s.id and user_id=s.user_id and flagged),
    'questions',(select jsonb_agg(case when s.answers ? (q->>'id') then q else q-'correct'-'explanation' end order by n)
      from jsonb_array_elements(s.questions) with ordinality x(q,n)),
    'summary',jsonb_build_object('total',jsonb_array_length(s.questions),
      'answered',(select count(*) from jsonb_each(s.answers)),
      'correct',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='correct'),
      'incorrect',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='incorrect'),
      'skipped',(select count(*) from jsonb_each(s.answers) a where a.value->>'outcome'='skipped')));
$$;
create or replace function mock_private.aurum_progress_summary(aid uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('total',count(*),'answered',count(outcome),'correct',count(*) filter(where outcome='correct'),
    'incorrect',count(*) filter(where outcome='incorrect'),'skipped',count(*) filter(where outcome='skipped'))
  from mock_private.aurum_question_progress where session_id=aid;
$$;
create or replace function mock_private.aurum_history_item(s mock_private.aurum_sessions) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',s.id,'source',s.source,'subjects',s.subjects,'status',s.status,'startedAt',s.started_at,
    'completedAt',s.completed_at,'summary',mock_private.aurum_progress_summary(s.id),
    'flagged',(select count(*) from mock_private.aurum_question_progress where session_id=s.id and flagged));
$$;

create or replace function mock_private.aurum_review_api(op text,p jsonb,owner_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  aid uuid; qid text; flagged_n boolean; s mock_private.aurum_sessions;
  limit_n integer=least(50,greatest(1,coalesce((p->>'limit')::integer,12)));
  offset_n integer=least(100000,greatest(0,coalesce((p->>'offset')::integer,0)));
  filter_n text=coalesce(p->>'filter','incorrect'); subject_n text=coalesce(p->>'subject',''); source_n text=coalesce(p->>'source',''); search_n text=coalesce(p->>'search','');
begin
  if owner_id is null then raise exception 'Aurum access is required'; end if;
  if op='aurum-flag' then
    aid=(p->>'sessionId')::uuid; qid=p->>'questionId';
    if jsonb_typeof(p->'flagged') is distinct from 'boolean' then raise exception 'Choose a valid flag state'; end if;
    select * into s from mock_private.aurum_sessions where id=aid and user_id=owner_id for update;
    if not found then raise exception 'Practice session not found'; end if;
    flagged_n=(p->>'flagged')::boolean;
    update mock_private.aurum_question_progress set flagged=flagged_n where session_id=aid and question_id=qid and user_id=owner_id;
    if not found then raise exception 'Question not found in this practice set'; end if;
    return jsonb_build_object('sessionId',aid,'questionId',qid,'flagged',flagged_n,
      'flags',(select coalesce(jsonb_agg(question_id order by question_number),'[]') from mock_private.aurum_question_progress where session_id=aid and user_id=owner_id and flagged));
  end if;
  if op='aurum-analysis' then
    return (with owned as materialized(select * from mock_private.aurum_question_progress where user_id=owner_id)
      select jsonb_build_object(
        'overall',(select jsonb_build_object('total',count(*),'answered',count(outcome),'correct',count(*) filter(where outcome='correct'),
          'incorrect',count(*) filter(where outcome='incorrect'),'skipped',count(*) filter(where outcome='skipped'),'flagged',count(*) filter(where flagged)) from owned),
        'sets',(select count(*) from mock_private.aurum_sessions where user_id=owner_id),
        'completedSets',(select count(*) from mock_private.aurum_sessions where user_id=owner_id and status='completed'),
        'runningSets',(select count(*) from mock_private.aurum_sessions where user_id=owner_id and status='running'),
        'subjects',(select coalesce(jsonb_agg(to_jsonb(x) order by x.incorrect desc,x.name),'[]') from (
          select subject name,count(*) total,count(outcome) answered,count(*) filter(where outcome='correct') correct,
            count(*) filter(where outcome='incorrect') incorrect,count(*) filter(where outcome='skipped') skipped,count(*) filter(where flagged) flagged
          from owned group by subject) x),
        'sources',(select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]') from (
          select origin name,count(*) total,count(outcome) answered,count(*) filter(where outcome='correct') correct,
            count(*) filter(where outcome='incorrect') incorrect,count(*) filter(where outcome='skipped') skipped,count(*) filter(where flagged) flagged
          from owned group by origin) x),
        'recent',(select coalesce(jsonb_agg(mock_private.aurum_history_item(x) order by x.started_at,x.id),'[]') from (
          select * from mock_private.aurum_sessions where user_id=owner_id and status='completed' order by started_at desc,id desc limit 12) x)));
  end if;
  if op='aurum-history' then
    return jsonb_build_object('items',(select coalesce(jsonb_agg(mock_private.aurum_history_item(x) order by x.started_at desc,x.id desc),'[]') from (
        select * from mock_private.aurum_sessions where user_id=owner_id order by started_at desc,id desc limit limit_n offset offset_n) x),
      'total',(select count(*) from mock_private.aurum_sessions where user_id=owner_id),'offset',offset_n,'limit',limit_n);
  end if;
  if op='aurum-review' then
    if filter_n not in ('all','incorrect','correct','skipped','flagged') or source_n not in ('','pyq','mock') or length(subject_n)>100 or length(search_n)>200 then
      raise exception 'Choose valid review filters'; end if;
    return (with base as materialized(select * from mock_private.aurum_question_progress where user_id=owner_id
        and (subject_n='' or subject=subject_n) and (source_n='' or origin=source_n) and (search_n='' or stem ilike '%'||search_n||'%')),
      chosen as (select * from base where filter_n='all' or filter_n='flagged' and flagged or outcome=filter_n)
      select jsonb_build_object(
        'items',(select coalesce(jsonb_agg(jsonb_build_object('sessionId',session_id,'questionId',question_id,'questionNumber',question_number,
          'subject',subject,'topic',topic,'source',origin,'stem',stem,'outcome',outcome,'flagged',flagged,'startedAt',started_at,'sessionStatus',session_status)
          order by started_at desc,session_id desc,question_number),'[]') from (
          select * from chosen order by started_at desc,session_id desc,question_number limit limit_n offset offset_n) x),
        'total',(select count(*) from chosen),'offset',offset_n,'limit',limit_n,
        'subjects',(select coalesce(jsonb_agg(subject order by subject),'[]') from (select distinct subject from mock_private.aurum_question_progress where user_id=owner_id) x),
        'counts',(select jsonb_build_object('all',count(*),'incorrect',count(*) filter(where outcome='incorrect'),'correct',count(*) filter(where outcome='correct'),
          'skipped',count(*) filter(where outcome='skipped'),'flagged',count(*) filter(where flagged)) from base)));
  end if;
  raise exception 'Unknown Aurum review operation';
end;
$$;
revoke all on function mock_private.aurum_sync_progress(),mock_private.aurum_progress_summary(uuid),
  mock_private.aurum_history_item(mock_private.aurum_sessions),mock_private.aurum_review_api(text,jsonb,uuid) from public,anon,authenticated;
do $review_dispatch$
declare
  definition text=pg_get_functiondef('mock_private.aurum_api(text,jsonb,uuid)'::regprocedure);
  anchor text=$anchor$  if op='aurum-state' then$anchor$;
  addition text=$addition$  if op in ('aurum-analysis','aurum-history','aurum-review','aurum-flag') then return mock_private.aurum_review_api(op,p,owner_id); end if;
$addition$;
begin
  if strpos(definition,addition)>0 then return; end if;
  if strpos(definition,anchor)=0 then raise exception 'Unrecognized Aurum API; review reporting dispatch'; end if;
  execute replace(definition,anchor,addition||anchor);
end;
$review_dispatch$;
