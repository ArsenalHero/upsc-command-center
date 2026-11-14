-- Preserve scoring, ownership and access checks. Opt-in saves return only an
-- acknowledgement instead of repeating the entire paper on every answer edit.
do $compact_autosave$
declare
 source_sql text := pg_get_functiondef('mock_private.api(text,jsonb)'::regprocedure);
 previous_fragment text := $old$ select * into a from mock_private.attempts where id=aid;
 rows=mock_private.attempt_public(a);$old$;
 compact_fragment text := $new$ select * into a from mock_private.attempts where id=aid;
 -- Compact acknowledgement for background autosaves. The ownership check,
 -- answer validation, sequence lock and expiry handling above still apply.
 if op='save' and p->>'compact'='true' then
 return jsonb_build_object('id',a.id,'testId',a.test_id,'status',a.status,'sequence',a.save_seq,'serverNow',clock_timestamp());
 end if;
 rows=mock_private.attempt_public(a);$new$;
begin
 if strpos(source_sql,previous_fragment)>0 then
  if (length(source_sql)-length(replace(source_sql,previous_fragment,'')))/length(previous_fragment)<>1 then
   raise exception 'Expected one attempt serialization point';
  end if;
  execute replace(source_sql,previous_fragment,compact_fragment);
 elsif strpos(source_sql,compact_fragment)=0 then
  raise exception 'Unrecognized attempt serialization; review the API before changing it';
 end if;
end;
$compact_autosave$;
