-- Aurum's seven requested choices. History/culture groupings affect only its
-- catalogue; source questions, fingerprints, sessions and exclusions stay intact.
create or replace function mock_private.aurum_subject_choices() returns text[]
language sql immutable set search_path='' as $$
  select array['Polity','Geography','AMAC','Modern History','Economy','CSAT','Science & Technology']::text[];
$$;
create or replace function mock_private.aurum_subject(s text) returns text
language sql immutable set search_path='' as $$
  select case lower(trim(s)) when 'economics' then 'Economy' when 'polity & governance' then 'Polity'
    when 'art and culture' then 'AMAC' when 'art & culture' then 'AMAC' when 'amac' then 'AMAC'
    when 'ancient history' then 'AMAC' when 'medieval history' then 'AMAC' when 'ancient india' then 'AMAC' when 'medieval india' then 'AMAC'
    when 'science and technology' then 'Science & Technology' when 'science and tech' then 'Science & Technology'
    else trim(s) end;
$$;
create or replace function mock_private.aurum_question_subject(q jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare name text=mock_private.aurum_subject(q->>'subject'); tag text=lower(coalesce(q->>'topic',''));
begin
  if name is null or name not in ('History','History & Culture') then return name; end if;
  if tag ~ 'modern|colonial|freedom|national|gandhi|independence|charter|cabinet|santhal|satyagraha' then return 'Modern History'; end if;
  if tag ~ 'ancient|medieval|prehistor|maury|buddh|ashok|bhakti|feudalis|south indian|(^|[^a-z])art([^a-z]|$)|cultur|architect|archaeolog|heritage|temple|dynast|philosoph|performing|festival|dance|craft|painting|textile|classical' then return 'AMAC'; end if;
  return 'Modern History';
end;
$$;
create or replace function mock_private.aurum_index_test() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  delete from mock_private.aurum_question_index where test_id=new.id;
  insert into mock_private.aurum_question_index(origin,source_id,fingerprint,subject,subjects,test_id)
    select 'mock',q->>'id',mock_private.aurum_fingerprint(q),mock_private.aurum_question_subject(q),
      array[mock_private.aurum_question_subject(q)],new.id from jsonb_array_elements(new.questions) q;
  return new;
end;
$$;
with mapped as (
  select i.source_id,mock_private.aurum_question_subject(i.question) subject,
    array(select distinct mock_private.aurum_question_subject(jsonb_build_object('subject',s,'topic',i.question->>'topic')) from unnest(i.subjects) s) subjects
  from mock_private.aurum_question_index i where i.origin='pyq'
)
update mock_private.aurum_question_index i set subject=m.subject,subjects=m.subjects from mapped m
  where i.origin='pyq' and i.source_id=m.source_id and (i.subject is distinct from m.subject or i.subjects is distinct from m.subjects);
update mock_private.aurum_question_index i set subject=x.subject,subjects=array[x.subject]
  from (select t.id test_id,q->>'id' source_id,mock_private.aurum_question_subject(q) subject
    from mock_private.tests t cross join lateral jsonb_array_elements(t.questions) q) x
  where i.origin='mock' and i.test_id=x.test_id and i.source_id=x.source_id
    and (i.subject is distinct from x.subject or i.subjects is distinct from array[x.subject]);

create or replace function mock_private.aurum_index_pool(owner_id uuid)
returns table(origin text,source_id text,fingerprint text,subject text,subjects text[],test_id uuid)
language sql stable set search_path='' as $$
  select i.origin,i.source_id,i.fingerprint,i.subject,i.subjects,i.test_id
  from mock_private.aurum_question_index i left join mock_private.tests t on t.id=i.test_id
  where i.subjects && mock_private.aurum_subject_choices()
    and (i.origin='pyq' or (t.listed and t.status='active' and t.publish_at<=now()
      and (t.scheduled_at is null or t.scheduled_at<=now()) and (t.closes_at is null or t.closes_at>now())))
    and not exists(select 1 from mock_private.aurum_seen s where s.user_id=owner_id and s.fingerprint=i.fingerprint)
    and not exists(select 1 from mock_private.aurum_seen s where s.user_id=owner_id and s.origin=i.origin and s.source_id=i.source_id);
$$;
revoke all on function mock_private.aurum_subject_choices(),mock_private.aurum_question_subject(jsonb) from public,anon,authenticated;

do $subject_choices$
declare
  definition text=pg_get_functiondef('mock_private.aurum_fast_api(text,jsonb,uuid)'::regprocedure);
  old_names text=$old$names as (select distinct unnest(i.subjects) name from mock_private.aurum_question_index i
        left join mock_private.tests t on t.id=i.test_id where i.origin='pyq' or (t.listed and t.status='active' and t.publish_at<=now()
          and (t.scheduled_at is null or t.scheduled_at<=now()) and (t.closes_at is null or t.closes_at>now())))$old$;
  new_names text=$new$names as (select name,ord from unnest(mock_private.aurum_subject_choices()) with ordinality choices(name,ord))$new$;
  old_guard text=$old$    if cardinality(selected)=0 then raise exception 'Select one or more subjects'; end if;$old$;
  new_guard text=$new$    if cardinality(selected)=0 then raise exception 'Select one or more subjects'; end if;
    if exists(select 1 from unnest(selected) name where not(name=any(mock_private.aurum_subject_choices()))) then
      raise exception 'Choose Polity, Geography, AMAC, Modern History, Economy, CSAT or Science & Technology';
    end if;$new$;
  legacy text;
begin
  if strpos(definition,new_names)=0 then
    if strpos(definition,old_names)=0 or strpos(definition,old_guard)=0 then raise exception 'Unrecognized Aurum catalogue; review subject choices'; end if;
    definition=replace(definition,old_names,new_names);
    definition=replace(definition,'order by n.name','order by n.ord');
    definition=replace(definition,old_guard,new_guard);
    execute definition;
  end if;
  legacy=pg_get_functiondef('mock_private.aurum_api(text,jsonb,uuid)'::regprocedure);
  if strpos(legacy,'mock_private.aurum_question_subject(q)')=0 then
    if (length(legacy)-length(replace(legacy,'mock_private.aurum_subject(q->>''subject'')','')))/length('mock_private.aurum_subject(q->>''subject'')')<>2 then
      raise exception 'Unrecognized Aurum question validation';
    end if;
    execute replace(legacy,'mock_private.aurum_subject(q->>''subject'')','mock_private.aurum_question_subject(q)');
  end if;
end;
$subject_choices$;
