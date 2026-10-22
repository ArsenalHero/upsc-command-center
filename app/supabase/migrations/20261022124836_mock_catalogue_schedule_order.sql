-- Keep the existing checked API; only replace catalogue ordering before pagination.
do $catalogue_schedule$
declare
 source_sql text := pg_get_functiondef('mock_private.api(text,jsonb)'::regprocedure);
 previous_order text := $old$order by year desc,created_at desc,id limit limit_n+1 offset offset_n$old$;
 schedule_order text := $new$order by year desc,scheduled_at asc nulls last,lower(series),regexp_replace(lower(code),'[0-9]+','','g'),nullif(substring(code from '([0-9]+)$'),'')::numeric,lower(code),id limit limit_n+1 offset offset_n$new$;
begin
 if strpos(source_sql,previous_order)>0 then
  if (length(source_sql)-length(replace(source_sql,previous_order,'')))/length(previous_order)<>1 then
   raise exception 'Catalogue ordering must occur exactly once';
  end if;
  execute replace(source_sql,previous_order,schedule_order);
 elsif strpos(source_sql,schedule_order)=0 then
  raise exception 'Unrecognized catalogue ordering; review the live API before changing it';
 end if;
end;
$catalogue_schedule$;

-- Original dates from Prelims CAMP 2026 brochure, pages 6–8, 11:00 AM IST.
-- Leave already scheduled tests and all questions/attempt snapshots intact.
update mock_private.tests t
set scheduled_at = d.scheduled_at
from (values
 ('CAMP-2026-PT-01',timestamptz '2025-11-17 05:30:00+00'),
 ('CAMP-2026-PT-02',timestamptz '2025-11-19 05:30:00+00'),
 ('CAMP-2026-PT-03',timestamptz '2025-11-21 05:30:00+00'),
 ('CAMP-2026-PT-04',timestamptz '2025-11-24 05:30:00+00'),
 ('CAMP-2026-PT-05',timestamptz '2025-11-26 05:30:00+00')
) as d(code,scheduled_at)
where t.code=d.code and t.scheduled_at is null;
