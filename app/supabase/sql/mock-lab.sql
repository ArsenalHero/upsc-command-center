-- Prelims Mock Test Lab. Private tables/keys; one checked RPC API.
create schema if not exists mock_private;
revoke all on schema mock_private from public;
create table if not exists mock_private.coaching (
 id uuid primary key default gen_random_uuid(), canonical_name text not null unique,
 display_name text not null, created_at timestamptz not null default now()
);
create table if not exists mock_private.tests (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 coaching_id uuid references mock_private.coaching(id), series text not null, year integer not null check(year between 1990 and 2200),
 paper text not null check(paper in ('GS-I','CSAT')), kind text not null check(kind in ('Sectional','Full Length','Topic Test','Revision Test','Current Affairs Test','PYQ Simulation')),
 subjects text[] not null default '{}', topics text[] not null default '{}', syllabus text not null default '', difficulty text not null default 'Moderate',
 duration integer not null check(duration between 1 and 300), language text not null default 'English',
 positive numeric not null check(positive>0 and positive<=100), negative numeric not null check(negative>=0 and negative<=100),
 publish_at timestamptz not null default now(), scheduled_at timestamptz, closes_at timestamptz,
 attempt_limit integer not null default 20 check(attempt_limit between 1 and 100), leaderboard boolean not null default true,
 status text not null default 'draft' check(status in ('draft','active','archived','closed')), questions jsonb not null default '[]',
 question_count integer not null default 0, maximum numeric not null default 0, created_at timestamptz not null default now()
);
alter table mock_private.tests add column if not exists listed boolean not null default true;
create table if not exists mock_private.report_documents (
 test_id uuid not null references mock_private.tests(id), kind text not null check(kind='recall'),
 title text not null, items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)>0), primary key(test_id,kind)
);
alter table mock_private.report_documents enable row level security;
revoke all on mock_private.report_documents from public,anon,authenticated;
create table if not exists mock_private.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 30 and display_name !~ '@'),
 target_accuracy numeric not null default 75 check(target_accuracy between 1 and 100), bookmarks uuid[] not null default '{}'
);
create unique index if not exists mock_profile_display_name on mock_private.profiles(lower(display_name));
create table if not exists mock_private.attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 test_id uuid references mock_private.tests(id), test_info jsonb not null, questions jsonb not null,
 mode text not null check(mode in ('official','practice')), eligible boolean not null default false,
 status text not null default 'running' check(status in ('running','submitted')),
 started_at timestamptz not null default now(), deadline timestamptz not null, submitted_at timestamptz,
 answers jsonb not null default '{}', current_index integer not null default 0, save_seq bigint not null default 0,
 result jsonb, score numeric, accuracy numeric, incorrect integer, elapsed integer,
 constraint official_requires_test check(not eligible or test_id is not null)
);
create unique index if not exists mock_one_running on mock_private.attempts(user_id,test_id) where status='running' and test_id is not null;
create unique index if not exists mock_first_eligible on mock_private.attempts(user_id,test_id) where eligible;
create index if not exists mock_history on mock_private.attempts(user_id,started_at desc);
create index if not exists mock_ranking on mock_private.attempts(test_id,score desc,accuracy desc,incorrect,elapsed,submitted_at) where eligible and status='submitted';
create index if not exists mock_deadlines on mock_private.attempts(deadline) where status='running';
create index if not exists mock_catalog on mock_private.tests(status,paper,year,coaching_id);
alter table mock_private.coaching enable row level security;
alter table mock_private.tests enable row level security;
alter table mock_private.profiles enable row level security;
alter table mock_private.attempts enable row level security;
revoke all on all tables in schema mock_private from public,anon,authenticated;

create or replace function mock_private.reverse_name(input text) returns text language sql immutable set search_path='' as $$
 select string_agg(case when token ~ '[[:alnum:]]' then reverse(token) else token end,'' order by n)
 from regexp_matches(trim(input),'[[:alnum:]''’]+|[^[:alnum:]''’]+','g') with ordinality as x(parts,n)
 cross join lateral (select parts[1] as token) t;
$$;
create or replace function mock_private.test_public(t mock_private.tests) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(t)-'questions'-'coaching_id' || jsonb_build_object('coachingId',t.coaching_id,'coaching',coalesce(c.display_name,'Command Centre'),'participants',
 (select count(*) from mock_private.attempts a where a.test_id=t.id and a.status='submitted' and a.eligible),
 'started',(select count(distinct user_id) from mock_private.attempts a where a.test_id=t.id))
 from (select 1) one left join mock_private.coaching c on c.id=t.coaching_id;
$$;
create or replace function mock_private.safe_questions(qs jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg((select jsonb_object_agg(k,v) from jsonb_each(q) e(k,v) where k in ('id','question','blocks','options','subject','topic','subtopic','difficulty','positive','negative')) order by n),'[]') from jsonb_array_elements(qs) with ordinality x(q,n);
$$;
create or replace function mock_private.finish(aid uuid) returns void language plpgsql set search_path='' as $$
 declare a mock_private.attempts; q jsonb; r jsonb; results jsonb='[]'; right_n integer=0; wrong_n integer=0; attempted integer=0;
 gross numeric=0; penalty numeric=0; outcome text; marks numeric; sec integer; maxmarks numeric=0; endtime timestamptz;
 begin
 select * into a from mock_private.attempts where id=aid for update;
 if not found or a.status='submitted' then return; end if;
 endtime=least(clock_timestamp(),a.deadline); sec=greatest(0,floor(extract(epoch from endtime-a.started_at))::integer);
 for q in select value from jsonb_array_elements(a.questions) loop
 r=coalesce(a.answers->(q->>'id'),'{}'); marks=0; outcome='Unattempted'; maxmarks=maxmarks+(q->>'positive')::numeric;
 if coalesce(r->>'option','')<>'' then attempted=attempted+1;
 if r->>'option'=q->>'correct' then right_n=right_n+1; gross=gross+(q->>'positive')::numeric; marks=(q->>'positive')::numeric; outcome='Correct';
 else wrong_n=wrong_n+1; penalty=penalty+(q->>'negative')::numeric; marks=-(q->>'negative')::numeric; outcome='Incorrect'; end if; end if;
 results=results||jsonb_build_array(q||jsonb_build_object('response',r,'outcome',outcome,'net',marks));
 end loop;
 update mock_private.attempts set status='submitted',submitted_at=endtime,score=round(gross-penalty,6),accuracy=case when attempted>0 then 100.0*right_n/attempted else 0 end,
 incorrect=wrong_n,elapsed=sec,result=jsonb_build_object('questions',results,'count',jsonb_array_length(a.questions),'attempted',attempted,'correct',right_n,'incorrect',wrong_n,
 'unattempted',jsonb_array_length(a.questions)-attempted,'gross',gross,'negative',penalty,'score',round(gross-penalty,6),'maximum',maxmarks,
 'accuracy',case when attempted>0 then 100.0*right_n/attempted else 0 end,'attemptRate',100.0*attempted/jsonb_array_length(a.questions),'seconds',sec) where id=aid;
 end;
$$;
create or replace function mock_private.expire(testid uuid default null,ownerid uuid default null) returns void language plpgsql set search_path='' as $$
 declare aid uuid;
 begin
 for aid in select id from mock_private.attempts where status='running' and deadline<=clock_timestamp() and (testid is null or test_id=testid) and (ownerid is null or user_id=ownerid) limit 200 for update skip locked loop perform mock_private.finish(aid); end loop;
 end;
$$;
create or replace function mock_private.board(testid uuid) returns table(attempt_id uuid,user_id uuid,display_name text,score numeric,accuracy numeric,incorrect integer,seconds integer,attempted integer,rank bigint,percentile numeric) language sql stable set search_path='' as $$
 with entries as (select a.id,a.user_id,p.display_name,a.score,a.accuracy,a.incorrect,a.elapsed,(a.result->>'attempted')::integer as attempted,a.submitted_at
 from mock_private.attempts a join mock_private.profiles p on p.user_id=a.user_id where a.test_id=testid and a.eligible and a.status='submitted')
 select id,user_id,display_name,score,accuracy,incorrect,elapsed,attempted,row_number() over(order by score desc,accuracy desc,incorrect,elapsed,submitted_at,id),
 100.0*((rank() over(order by score)-1)+0.5*count(*) over(partition by score))/count(*) over() from entries;
$$;
create or replace function mock_private.attempt_public(a mock_private.attempts) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'testId',a.test_id,'test',a.test_info,'mode',a.mode,'eligible',a.eligible,'status',a.status,'startedAt',a.started_at,'deadline',a.deadline,
 'submittedAt',a.submitted_at,'answers',a.answers,'index',a.current_index,'sequence',a.save_seq,'serverNow',clock_timestamp(),
 'reportDocuments',case when a.status='submitted' then (select coalesce(jsonb_agg(jsonb_build_object('kind',d.kind,'title',d.title,'itemCount',jsonb_array_length(d.items)) order by d.kind),'[]') from mock_private.report_documents d where d.test_id=a.test_id) else '[]'::jsonb end,
 'questions',case when a.status='running' then mock_private.safe_questions(a.questions) else a.questions end,'result',a.result);
$$;
create or replace function mock_private.save_answers(aid uuid,p jsonb) returns void language plpgsql set search_path='' as $$
 declare a mock_private.attempts; q jsonb; r jsonb; checked jsonb='{}'; secs integer; seq bigint; idx integer;
 begin
 select * into a from mock_private.attempts where id=aid for update;
 if a.status<>'running' then return; end if;
 if clock_timestamp()>=a.deadline then perform mock_private.finish(aid); return; end if;
 seq=coalesce((p->>'sequence')::bigint,a.save_seq+1); if seq<=a.save_seq then return; end if;
 idx=coalesce((p->>'index')::integer,a.current_index); if idx<0 or idx>=jsonb_array_length(a.questions) then raise exception 'Invalid question position'; end if;
 if jsonb_typeof(p->'answers') is distinct from 'object' then raise exception 'Invalid answers'; end if;
 secs=greatest(0,floor(extract(epoch from clock_timestamp()-a.started_at))::integer);
 for q in select value from jsonb_array_elements(a.questions) loop
 r=coalesce(p->'answers'->(q->>'id'),a.answers->(q->>'id'),'{}');
 if coalesce(r->>'option','')<>'' and not (q->'options' ? (r->>'option')) then raise exception 'Invalid answer option'; end if;
 checked=checked||jsonb_build_object(q->>'id',jsonb_build_object('option',coalesce(r->>'option',''),'review',coalesce((r->>'review')::boolean,false),
 'visited',coalesce((r->>'visited')::boolean,false),'firstSeen',case when coalesce((a.answers->(q->>'id')->>'visited')::boolean,false) then a.answers->(q->>'id')->'firstSeen' else to_jsonb(secs) end,'answeredAt',case when r->>'option' is distinct from a.answers->(q->>'id')->>'option' and coalesce(r->>'option','')<>'' then to_jsonb(secs) else a.answers->(q->>'id')->'answeredAt' end,'seconds',least(secs,greatest(0,coalesce((r->>'seconds')::integer,0))),
 'confidence',case when r->>'confidence' in ('High','Medium','Low') then r->>'confidence' else '' end,
 'strategy',case when r->>'strategy' in ('Sure','Eliminated 1 Option','Eliminated 2 Options','Educated Guess','Pure Guess') then r->>'strategy' else '' end));
 end loop;
 update mock_private.attempts set answers=checked,current_index=idx,save_seq=seq where id=aid;
 end;
$$;

create or replace function mock_private.api(op text,p jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_column
 declare u uuid=auth.uid(); admin boolean=false; a mock_private.attempts; t mock_private.tests; tid uuid; aid uuid; qs jsonb; q jsonb; r jsonb; profile mock_private.profiles;
 rows jsonb; meta jsonb; mine jsonb; stats jsonb; limit_n integer=least(100,greatest(1,coalesce((p->>'limit')::integer,24))); offset_n integer=least(100000,greatest(0,coalesce((p->>'offset')::integer,0)));
 name_n text; cid uuid; n integer; maximum_n numeric; newq jsonb; coach text; seq text;
 begin
 if op in ('catalog','detail') then
 if op='detail' then select * into t from mock_private.tests where id=(p->>'testId')::uuid and listed and status<>'draft' and publish_at<=now();
 if not found then raise exception 'Test not available'; end if;
 perform mock_private.expire(t.id); select jsonb_build_object('count',count(*),'mean',avg(score),'median',percentile_cont(0.5) within group(order by score),'highest',max(score),'accuracy',avg(accuracy),'seconds',avg(elapsed)) into stats from mock_private.attempts where test_id=t.id and eligible and status='submitted';
 return jsonb_build_object('test',mock_private.test_public(t),'statistics',case when (stats->>'count')::integer>=5 then stats else null end); end if;
 select coalesce(jsonb_agg(mock_private.test_public(x)),'[]') into rows from (select * from mock_private.tests x where listed and status<>'draft' and publish_at<=now()
 and (coalesce(p->>'search','')='' or (name||' '||code||' '||syllabus) ilike '%'||(p->>'search')||'%')
 and (coalesce(p->>'paper','')='' or paper=p->>'paper') and (coalesce(p->>'kind','')='' or kind=p->>'kind')
 and (coalesce(p->>'year','')='' or year=(p->>'year')::integer) and (coalesce(p->>'series','')='' or series=p->>'series')
 and (coalesce(p->>'coachingId','')='' or coaching_id=(p->>'coachingId')::uuid) and (coalesce(p->>'subject','')='' or p->>'subject'=any(subjects))
 and (coalesce(p->>'topic','')='' or p->>'topic'=any(topics)) and (coalesce(p->>'difficulty','')='' or difficulty=p->>'difficulty')
 and (coalesce(p->>'status','')='' or status=p->>'status')
 and (coalesce(p->>'participation','')='' or p->>'participation'='Not Attempted' and not exists(select 1 from mock_private.attempts aa where aa.test_id=x.id and aa.user_id=u)
 or p->>'participation'='Attempted' and exists(select 1 from mock_private.attempts aa where aa.test_id=x.id and aa.user_id=u)
 or p->>'participation'='Completed' and exists(select 1 from mock_private.attempts aa where aa.test_id=x.id and aa.user_id=u and aa.status='submitted')
 or p->>'participation'='Bookmarked' and exists(select 1 from mock_private.profiles pp where pp.user_id=u and x.id=any(pp.bookmarks)))
 and question_count>=coalesce((p->>'minQuestions')::integer,0) and duration<=coalesce((p->>'maxDuration')::integer,300)
 order by year desc,created_at desc,id limit limit_n+1 offset offset_n) x;
 select jsonb_build_object('coaching',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name) order by display_name),'[]') from mock_private.coaching c where exists(select 1 from mock_private.tests t where t.coaching_id=c.id and t.listed and t.status<>'draft')),
 'years',(select coalesce(jsonb_agg(year order by year desc),'[]') from (select distinct year from mock_private.tests where listed and status<>'draft') y),
 'series',(select coalesce(jsonb_agg(series order by series),'[]') from (select distinct series from mock_private.tests where listed and status<>'draft') y),
 'subjects',(select coalesce(jsonb_agg(subject order by subject),'[]') from (select distinct unnest(subjects) subject from mock_private.tests where listed and status<>'draft') y),
 'topics',(select coalesce(jsonb_agg(topic order by topic),'[]') from (select distinct unnest(topics) topic from mock_private.tests where listed and status<>'draft') y)) into meta;
 return jsonb_build_object('tests',rows,'facets',meta); end if;
 if u is null or not exists(select 1 from auth.users where id=u and not coalesce(is_anonymous,false) and email_confirmed_at is not null) then raise exception 'Sign in with a verified account to participate'; end if;
 select coalesce(raw_app_meta_data->>'mock_admin','false')='true' into admin from auth.users where id=u;
 if op='identity' then select * into profile from mock_private.profiles where user_id=u; return jsonb_build_object('profile',case when found then to_jsonb(profile)-'user_id' else null end,'admin',admin); end if;
 if op='profile' then name_n=trim(p->>'displayName');
 if name_n is null or name_n !~ '^[[:alnum:] _-]{2,30}$' then raise exception 'Use 2–30 letters, numbers, spaces, underscores or hyphens for your leaderboard name'; end if;
 insert into mock_private.profiles(user_id,display_name,target_accuracy) values(u,name_n,coalesce((p->>'targetAccuracy')::numeric,75)) on conflict(user_id) do update set display_name=excluded.display_name,target_accuracy=excluded.target_accuracy;
 return jsonb_build_object('display_name',name_n); end if;
 if op='bookmark-test' then
 tid=(p->>'testId')::uuid; if not exists(select 1 from mock_private.tests where id=tid and status<>'draft') then raise exception 'Test not available'; end if;
 update mock_private.profiles set bookmarks=case when tid=any(bookmarks) then array_remove(bookmarks,tid) else array_append(bookmarks,tid) end where user_id=u;
 return '{}'; end if;
 if op='admin-get' then if not admin then raise exception 'Administrator access required'; end if;
 select * into t from mock_private.tests where id=(p->>'testId')::uuid; if not found then raise exception 'Test not found'; end if;
 return jsonb_build_object('test',mock_private.test_public(t),'questions',t.questions); end if;
 if op='admin-list' then if not admin then raise exception 'Administrator access required'; end if;
 return jsonb_build_object('tests',(select coalesce(jsonb_agg(mock_private.test_public(x)),'[]') from mock_private.tests x),'coaching',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name)),'[]') from mock_private.coaching)); end if;
 if op='admin-coaching' then if not admin then raise exception 'Administrator access required'; end if;
 coach=upper(trim(p->>'name')); if length(coach)<2 or length(coach)>100 then raise exception 'Institute name must be 2–100 characters'; end if;
 insert into mock_private.coaching(canonical_name,display_name) values(coach,mock_private.reverse_name(coach)) on conflict(canonical_name) do update set display_name=excluded.display_name returning id into cid;
 return jsonb_build_object('id',cid,'name',mock_private.reverse_name(coach)); end if;
 if op='admin-test' then if not admin then raise exception 'Administrator access required'; end if;
 if p->>'action' in ('archive','close') then update mock_private.tests set status=case when p->>'action'='archive' then 'archived' else 'closed' end where id=(p->>'id')::uuid; return '{}'; end if;
 qs=coalesce(p->'questions','[]'); n=jsonb_array_length(qs); if n<1 or n>250 then raise exception 'Upload 1–250 complete questions'; end if;
 if p->>'paper' not in ('GS-I','CSAT') then raise exception 'Only GS-I and CSAT mocks are supported'; end if;
 if p->>'kind'='Full Length' and n<>(case when p->>'paper'='GS-I' then 100 else 80 end) then raise exception 'Full-length mocks require 100 GS-I or 80 CSAT questions'; end if;
 newq='[]'; maximum_n=0;
 for q in select value from jsonb_array_elements(qs) loop
 if length(coalesce(q->>'question',''))<8 or jsonb_typeof(q->'options')<>'object' or (select count(*) from jsonb_object_keys(q->'options')) not in (4,5) or not(q->'options' ? lower(q->>'correct')) or length(coalesce(q->>'explanation',''))<8
 or (select count(distinct lower(trim(value))) from jsonb_each_text(q->'options'))<>(select count(*) from jsonb_object_keys(q->'options'))
 or exists(select 1 from jsonb_each_text(q->'options') where trim(value)='' or key not in ('a','b','c','d','e')) then raise exception 'Each question needs distinct choices, a valid answer and an explanation'; end if;
 if coalesce(q->>'subject','')='' or coalesce(q->>'topic','')='' then raise exception 'Every question needs a subject and topic'; end if;
 if coalesce((q->>'positive')::numeric,(p->>'positive')::numeric,2)<=0 or coalesce((q->>'negative')::numeric,(p->>'negative')::numeric,0)<0 then raise exception 'Invalid marking scheme'; end if;
 q=q||jsonb_build_object('id',gen_random_uuid(),'correct',lower(q->>'correct'),'positive',coalesce((q->>'positive')::numeric,(p->>'positive')::numeric,2),'negative',coalesce((q->>'negative')::numeric,(p->>'negative')::numeric,0),'difficulty',coalesce(nullif(q->>'difficulty',''),'Moderate'));
 newq=newq||jsonb_build_array(q); maximum_n=maximum_n+(q->>'positive')::numeric;
 end loop;
 if (select count(distinct md5(lower(regexp_replace(q->>'question','\s+',' ','g'))||(q->'options')::text)) from jsonb_array_elements(newq) q)<>n then raise exception 'Repeated questions in this mock'; end if;
 tid=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from mock_private.attempts where test_id=tid) then raise exception 'A test with attempts is immutable; clone it as a new test'; end if;
 insert into mock_private.tests(id,code,name,coaching_id,series,year,paper,kind,subjects,topics,syllabus,difficulty,duration,positive,negative,scheduled_at,closes_at,publish_at,attempt_limit,leaderboard,status,questions,question_count,maximum)
 values(tid,trim(p->>'code'),trim(p->>'name'),nullif(p->>'coachingId','')::uuid,coalesce(nullif(p->>'series',''),'Prelims Test Series'),(p->>'year')::integer,p->>'paper',p->>'kind',
 array(select distinct value->>'subject' from jsonb_array_elements(newq)),array(select distinct value->>'topic' from jsonb_array_elements(newq)),coalesce(p->>'syllabus',''),coalesce(p->>'difficulty','Moderate'),(p->>'duration')::integer,
 coalesce((p->>'positive')::numeric,2),coalesce((p->>'negative')::numeric,0),nullif(p->>'scheduledAt','')::timestamptz,nullif(p->>'closesAt','')::timestamptz,coalesce(nullif(p->>'publishAt','')::timestamptz,now()),coalesce((p->>'attemptLimit')::integer,20),coalesce((p->>'leaderboard')::boolean,true),coalesce(p->>'status','draft'),newq,n,maximum_n)
 on conflict(id) do update set code=excluded.code,name=excluded.name,coaching_id=excluded.coaching_id,series=excluded.series,year=excluded.year,paper=excluded.paper,kind=excluded.kind,subjects=excluded.subjects,topics=excluded.topics,syllabus=excluded.syllabus,difficulty=excluded.difficulty,duration=excluded.duration,positive=excluded.positive,negative=excluded.negative,scheduled_at=excluded.scheduled_at,closes_at=excluded.closes_at,publish_at=excluded.publish_at,attempt_limit=excluded.attempt_limit,leaderboard=excluded.leaderboard,status=excluded.status,questions=excluded.questions,question_count=n,maximum=maximum_n;
 return jsonb_build_object('id',tid); end if;
 if op='start' then
 if not exists(select 1 from mock_private.profiles where user_id=u) then raise exception 'Choose your leaderboard display name first'; end if;
 tid=nullif(p->>'testId','')::uuid; perform pg_advisory_xact_lock(hashtextextended(u::text||coalesce(tid::text,'mistakes'),0));
 perform mock_private.expire(tid,u);
 if tid is not null then
 select * into t from mock_private.tests where id=tid for share;
 if not found or not t.listed or t.status<>'active' or t.publish_at>now() or t.scheduled_at>now() or t.closes_at<=now() then raise exception 'This test is not open for new attempts'; end if;
 select * into a from mock_private.attempts where test_id=tid and user_id=u and status='running';
 if found then return mock_private.attempt_public(a); end if;
 if (select count(*) from mock_private.attempts where test_id=tid and user_id=u)>=t.attempt_limit then raise exception 'Attempt limit reached'; end if;
 qs=t.questions; meta=mock_private.test_public(t);
 else
 select coalesce(jsonb_agg(q),'[]') into qs from (select distinct on (md5(q->>'question'||(q->'options')::text)) q
 from mock_private.attempts a cross join lateral jsonb_array_elements(a.result->'questions') q where a.user_id=u and a.status='submitted' and a.test_info->>'paper'=coalesce(p->>'paper','GS-I')
 and (case when p->>'selection'='bookmarks' then coalesce((q->'response'->>'bookmarked')::boolean,false) else q->>'outcome'='Incorrect' end) limit 50) x;
 if jsonb_array_length(qs)=0 then raise exception 'No questions available for this practice selection'; end if;
 select jsonb_agg(q-'response'-'outcome'-'net'||jsonb_build_object('id',gen_random_uuid())) into qs from jsonb_array_elements(qs) q;
 meta=jsonb_build_object('name','Practice my mistakes','paper',coalesce(p->>'paper','GS-I'),'kind','Revision Test','coaching','Command Centre','year',extract(year from now()),'duration',greatest(5,jsonb_array_length(qs)*2),'maximum',(select sum((q->>'positive')::numeric) from jsonb_array_elements(qs) q));
 end if;
 insert into mock_private.attempts(user_id,test_id,test_info,questions,mode,eligible,deadline)
 values(u,tid,meta,qs,case when tid is not null and coalesce(p->>'mode','official')='official' and t.leaderboard and not exists(select 1 from mock_private.attempts where user_id=u and test_id=tid and eligible) then 'official' else 'practice' end,
 tid is not null and coalesce(p->>'mode','official')='official' and t.leaderboard and not exists(select 1 from mock_private.attempts where user_id=u and test_id=tid and eligible),now()+make_interval(mins=>(meta->>'duration')::integer)) returning * into a;
 return mock_private.attempt_public(a); end if;
 if op='report-document' then
 select * into a from mock_private.attempts where id=(p->>'attemptId')::uuid and user_id=u;
 if not found then raise exception 'Attempt not found'; end if;
 if a.status<>'submitted' then raise exception 'Submit the test before opening report documents'; end if;
 select jsonb_build_object('kind',d.kind,'title',d.title,'items',d.items) into rows from mock_private.report_documents d where d.test_id=a.test_id and d.kind=p->>'kind';
 if rows is null then raise exception 'Report document not available'; end if; return rows; end if;
 if op in ('save','submit','attempt','annotate') then
 aid=(p->>'attemptId')::uuid; select * into a from mock_private.attempts where id=aid and user_id=u for update;
 if not found then raise exception 'Attempt not found'; end if;
 if op in ('save','submit') and p ? 'answers' then perform mock_private.save_answers(a.id,p); end if;
 if op='submit' or (a.status='running' and clock_timestamp()>=a.deadline) then perform mock_private.finish(a.id); end if;
 if op='annotate' then
 if a.status<>'submitted' then raise exception 'Submit the test before reviewing'; end if;
 name_n=p->>'questionId'; if not exists(select 1 from jsonb_array_elements(a.questions) q where q->>'id'=name_n) then raise exception 'Question not found'; end if;
 r=coalesce(a.answers->name_n,'{}')||jsonb_build_object('note',left(coalesce(p->>'note',''),4000),'errorType',left(coalesce(p->>'errorType',''),80),'bookmarked',coalesce((p->>'bookmarked')::boolean,false),'revisionDate',nullif(p->>'revisionDate',''));
 update mock_private.attempts set answers=jsonb_set(answers,array[name_n],r,true),result=jsonb_set(result,'{questions}',(select jsonb_agg(case when q->>'id'=name_n then q||jsonb_build_object('response',r) else q end order by n) from jsonb_array_elements(result->'questions') with ordinality x(q,n))) where id=a.id;
 end if;
 select * into a from mock_private.attempts where id=aid;
 rows=mock_private.attempt_public(a);
 if a.status='submitted' and a.test_id is not null then
 perform mock_private.expire(a.test_id); select to_jsonb(b)-'user_id'-'attempt_id' into mine from mock_private.board(a.test_id) b where b.user_id=u;
 select jsonb_build_object('participants',count(*),'mean',avg(score),'median',percentile_cont(0.5) within group(order by score),'highest',max(score),'accuracy',avg(accuracy),'seconds',avg(seconds)) into stats from mock_private.board(a.test_id);
 select coalesce(jsonb_agg(x),'[]') into meta from (select jsonb_build_object('score',b.score,'accuracy',b.accuracy,'seconds',b.seconds,'attempted',b.attempted,'mine',b.user_id=u) x
 from ((select * from mock_private.board(a.test_id) where user_id<>u order by md5(attempt_id::text) limit 99) union all (select * from mock_private.board(a.test_id) where user_id=u)) b) y;
 if (stats->>'participants')::integer>=5 then
 stats=stats||jsonb_build_object('top25Median',(select percentile_cont(0.5) within group(order by score) from mock_private.board(a.test_id) where percentile>=75),'top10Median',(select percentile_cont(0.5) within group(order by score) from mock_private.board(a.test_id) where percentile>=90),
 'histogram',(select jsonb_agg(jsonb_build_object('name',low::text||'–'||(low+20)::text,'low',low,'high',low+20,'value',n) order by low) from (select floor(score/20)::integer*20 low,count(*) n from mock_private.board(a.test_id) group by 1) h),
 'curve',(select jsonb_agg(jsonb_build_object('score',v,'percentile',n-1) order by n) from (select percentile_cont(array(select i/100.0 from generate_series(0,100) i)) within group(order by score) as quantiles from mock_private.board(a.test_id)) z cross join lateral unnest(z.quantiles) with ordinality y(v,n)));
 end if;
 rows=rows||jsonb_build_object('position',case when a.eligible then mine else null end,'community',case when (stats->>'participants')::integer>=5 then stats||jsonb_build_object('sample',meta) else jsonb_build_object('participants',stats->'participants') end);
 if (stats->>'participants')::integer>=5 then
 select jsonb_object_agg(qid,dist) into meta from (select q->>'id' qid,jsonb_build_object('responses',count(*),'correct',count(*) filter(where q->>'outcome'='Correct'),
 'a',count(*) filter(where q->'response'->>'option'='a'),'b',count(*) filter(where q->'response'->>'option'='b'),'c',count(*) filter(where q->'response'->>'option'='c'),'d',count(*) filter(where q->'response'->>'option'='d'),'e',count(*) filter(where q->'response'->>'option'='e')) dist
 from mock_private.attempts x cross join lateral jsonb_array_elements(x.result->'questions') q where x.test_id=a.test_id and x.eligible and x.status='submitted' group by q->>'id') x;
 rows=rows||jsonb_build_object('questionCommunity',meta); end if;
 end if;
 if a.status='submitted' then
 select jsonb_build_object('count',count(*),'accuracy',avg(x.accuracy),'attemptRate',avg((x.result->>'attemptRate')::numeric),'scorePercent',avg(greatest(0,100*x.score/nullif((x.result->>'maximum')::numeric,0))),'penaltyControl',avg(100*(1-(x.result->>'negative')::numeric/greatest(1,(select sum((z->>'negative')::numeric) from jsonb_array_elements(x.questions) z)))),'timeBudget',avg(100*least(1,(x.test_info->>'duration')::numeric*60/greatest(1,x.elapsed)))) into stats from mock_private.attempts x where x.user_id=u and x.status='submitted' and x.started_at<a.started_at and x.test_info->>'paper'=a.test_info->>'paper';
 if (stats->>'count')::integer>0 then rows=rows||jsonb_build_object('historyBaseline',stats); end if; end if;
 return rows; end if;
 if op='summary' then perform mock_private.expire(null,u);
 select jsonb_build_object('mocks',count(*),'gs',count(*) filter(where test_info->>'paper'='GS-I'),'csat',count(*) filter(where test_info->>'paper'='CSAT'),
 'sectional',count(*) filter(where test_info->>'kind'='Sectional'),'fullLength',count(*) filter(where test_info->>'kind'='Full Length'),
 'attempted',coalesce(sum((result->>'attempted')::integer),0),'accuracy',case when sum((result->>'attempted')::integer)>0 then 100.0*sum((result->>'correct')::integer)/sum((result->>'attempted')::integer) else null end,
 'negative',coalesce(sum((result->>'negative')::numeric),0),'thisMonth',count(*) filter(where date_trunc('month',started_at at time zone 'Asia/Kolkata')=date_trunc('month',now() at time zone 'Asia/Kolkata')),
 'meanPercentile',(select avg(b.percentile) from mock_private.tests t cross join lateral mock_private.board(t.id) b where b.user_id=u and (coalesce(p->>'paper','')='' or t.paper=p->>'paper')),
 'bestPercentile',(select max(b.percentile) from mock_private.tests t cross join lateral mock_private.board(t.id) b where b.user_id=u and (coalesce(p->>'paper','')='' or t.paper=p->>'paper')))
 into stats from mock_private.attempts where user_id=u and status='submitted' and (coalesce(p->>'paper','')='' or test_info->>'paper'=p->>'paper');
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (select q->>'topic' as topic,count(*) as questions,count(*) filter(where q->>'outcome'='Incorrect') as errors,
 count(distinct a.id) as test_count,case when count(*) filter(where q->>'outcome'<>'Unattempted')>0 then 100.0*count(*) filter(where q->>'outcome'='Correct')/count(*) filter(where q->>'outcome'<>'Unattempted') else null end as accuracy,
 sum((q->>'net')::numeric) as net from mock_private.attempts a cross join lateral jsonb_array_elements(a.result->'questions') q where a.user_id=u and a.status='submitted' and (coalesce(p->>'paper','')='' or a.test_info->>'paper'=p->>'paper')
 group by q->>'topic' order by count(*) filter(where q->>'outcome'='Incorrect') desc limit 30) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into meta from (select (started_at at time zone 'Asia/Kolkata')::date as day,count(*) as mocks,sum((result->>'attempted')::integer) as questions,avg(accuracy) as accuracy,avg(case when eligible then (select b.percentile from mock_private.board(test_id) b where b.user_id=u) end) as percentile
 from mock_private.attempts where user_id=u and status='submitted' and started_at>=now()-interval '1 year' and (coalesce(p->>'paper','')='' or test_info->>'paper'=p->>'paper') group by 1 order by 1) x;
 stats=stats||jsonb_build_object('weakTopics',rows,'activity',meta);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (select q->>'subject' as name,count(*) as questions,count(*) filter(where q->>'outcome'<>'Unattempted') as attempted,100.0*count(*) filter(where q->>'outcome'='Correct')/nullif(count(*) filter(where q->>'outcome'<>'Unattempted'),0) as accuracy from mock_private.attempts a cross join lateral jsonb_array_elements(a.result->'questions') q where a.user_id=u and a.status='submitted' and (coalesce(p->>'paper','')='' or a.test_info->>'paper'=p->>'paper') group by q->>'subject' order by accuracy desc nulls last) x;
 stats=stats||jsonb_build_object('subjects',rows,'commonError',(select coalesce(nullif(q->'response'->>'errorType',''),'Untagged') from mock_private.attempts a cross join lateral jsonb_array_elements(a.result->'questions') q where a.user_id=u and a.status='submitted' and q->>'outcome'='Incorrect' and (coalesce(p->>'paper','')='' or a.test_info->>'paper'=p->>'paper') group by 1 order by count(*) desc limit 1));
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (select test_info->>'coaching' as coaching,test_info->>'year' as year,test_info->>'paper' as paper,test_info->>'kind' as kind,count(*) as mocks,avg(100.0*score/nullif((result->>'maximum')::numeric,0)) as score_percent,avg(accuracy) as accuracy,avg((result->>'negative')::numeric) as negative,avg((result->>'attemptRate')::numeric) as attempt_rate,avg(elapsed) as seconds,stddev_pop(100.0*score/nullif((result->>'maximum')::numeric,0)) as consistency,avg(case when eligible then (select b.percentile from mock_private.board(test_id) b where b.user_id=u) end) as percentile from mock_private.attempts where user_id=u and status='submitted' and (coalesce(p->>'paper','')='' or test_info->>'paper'=p->>'paper') group by 1,2,3,4 order by 2 desc,1) x;
 return stats||jsonb_build_object('comparisons',rows); end if;
 if op='history' then perform mock_private.expire(null,u);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'testId',test_id,'test',test_info,'mode',mode,'eligible',eligible,'status',status,'startedAt',started_at,'result',result-'questions','position',case when eligible then (select to_jsonb(b)-'user_id'-'attempt_id' from mock_private.board(test_id) b where b.user_id=u) else null end)),'[]') into rows
 from (select * from mock_private.attempts where user_id=u order by started_at desc,id limit limit_n+1 offset offset_n) x;
 return rows; end if;
 if op='notebook' then perform mock_private.expire(null,u);
 select coalesce(jsonb_agg(row),'[]') into rows from (select jsonb_build_object('attemptId',a.id,'test',a.test_info,'question',q) row from mock_private.attempts a cross join lateral jsonb_array_elements(a.result->'questions') q where a.user_id=u and a.status='submitted'
 and (p->>'selection'='bookmarks' and coalesce((q->'response'->>'bookmarked')::boolean,false) or coalesce(p->>'selection','mistakes')='mistakes' and q->>'outcome'='Incorrect') order by a.started_at desc limit limit_n+1 offset offset_n) x; return rows; end if;
 if op='leaderboard' then
 tid=(p->>'testId')::uuid; if not exists(select 1 from mock_private.attempts where user_id=u and test_id=tid) then raise exception 'Join this mock to view its participant leaderboard'; end if;
 perform mock_private.expire(tid);
 select to_jsonb(b)-'user_id'-'attempt_id' into mine from mock_private.board(tid) b where user_id=u;
 select coalesce(jsonb_agg(to_jsonb(b)-'user_id'-'attempt_id'),'[]') into rows from (select * from mock_private.board(tid) where coalesce(p->>'search','')='' or display_name ilike '%'||(p->>'search')||'%' order by rank limit limit_n offset offset_n) b;
 return jsonb_build_object('rows',rows,'mine',mine,'participants',(select count(*) from mock_private.board(tid))); end if;
 if op='championship' then
 -- Equal weight per first-valid test percentile; no practice/spam count advantage.
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (select pr.display_name,avg(b.percentile) as percentile,stddev_pop(b.percentile) as variability,count(*) as tests,count(*) filter(where t.kind='Full Length') as full_length,
 count(distinct t.subjects[1]) as breadth from mock_private.tests t cross join lateral mock_private.board(t.id) b join mock_private.profiles pr on pr.user_id=b.user_id
 where t.paper=coalesce(p->>'paper','GS-I') and (p->>'year' is null or t.year=(p->>'year')::integer)
 group by pr.display_name having count(*)>=greatest(3,coalesce((p->>'minTests')::integer,3)) and count(*) filter(where t.kind='Full Length')>=1
 order by avg(b.percentile) desc,stddev_pop(b.percentile),pr.display_name limit limit_n offset offset_n) x;
 return jsonb_build_object('rows',rows,'rules','At least three eligible first attempts and one full-length mock. Mean per-test percentile; lower variability breaks ties. GS-I and CSAT are separate.'); end if;
 raise exception 'Unknown mock operation';
 end;
$$;
create or replace function public.mock_lab(op text,p jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select mock_private.api(op,p); $$;
revoke all on all functions in schema mock_private from public,anon,authenticated;
grant usage on schema mock_private to anon,authenticated;
grant execute on function mock_private.api(text,jsonb) to anon,authenticated;
revoke all on function public.mock_lab(text,jsonb) from public;
grant execute on function public.mock_lab(text,jsonb) to anon,authenticated;
