-- Add catalogue-wide metadata after the existing license and session checks.
-- Existing scoring, ownership, drafts and publication rules remain intact.
do $mock_catalogue_totals$
declare
 source_sql text := pg_get_functiondef('mock_private.api(text,jsonb)'::regprocedure);
 old_fragment text := $old$ if op in ('catalog','detail') then$old$;
 new_fragment text := $new$ if op='catalog-summary' then
   return (select jsonb_build_object('tests',count(*),'questions',coalesce(sum(question_count),0))
     from mock_private.tests where listed and status<>'draft' and publish_at<=now());
 end if;
 if op in ('catalog','detail') then$new$;
begin
 if strpos(source_sql,new_fragment)>0 then
   return;
 end if;
 if (length(source_sql)-length(replace(source_sql,old_fragment,'')))/length(old_fragment)<>1
    or strpos(source_sql,'License verification is required to access Mock Tests')=0 then
   raise exception 'Unrecognized catalogue API; review before adding totals';
 end if;
 execute replace(source_sql,old_fragment,new_fragment);
end;
$mock_catalogue_totals$;
