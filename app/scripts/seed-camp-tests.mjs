import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Trusted, server-only text imports. Never bundle question keys into the app.
export function validateCampTests(tests) {
  assert.ok(Array.isArray(tests) && tests.length, 'Supply at least one CAMP test');
  const codes = new Set(), ids = new Set();
  for (const t of tests) {
    assert.match(t.code, /^CAMP-2026-PT-\d{2}$/);
    assert.ok(!codes.has(t.code), 'Duplicate test code'); codes.add(t.code);
    assert.equal(t.paper, 'GS-I'); assert.equal(t.year, 2026);
    assert.equal(t.duration, 60); assert.equal(t.positive, 2);
    assert.equal(t.negative, 2 / 3); assert.equal(t.questions.length, 50);
    assert.ok(t.syllabus?.length > 100, 'Missing full syllabus');
    for (const source of ['questions', 'explanations', 'recall']) assert.match(t.sourceHashes?.[source] || '', /^[a-f0-9]{64}$/);
    const fingerprints = new Set();
    for (const [i, q] of t.questions.entries()) {
      assert.equal(q.number, i + 1); assert.match(q.id, /^[a-f0-9-]{36}$/);
      assert.ok(!ids.has(q.id), 'Question IDs must be unique across tests'); ids.add(q.id);
      assert.deepEqual(Object.keys(q.options), ['a', 'b', 'c', 'd']);
      assert.ok(q.options[q.correct] && Object.values(q.options).every(v => v.trim()), 'Missing option/key');
      assert.ok(q.question.trim().length > 8 && q.explanation.trim().length > 20 && q.topic && q.subject === 'Polity');
      assert.equal(q.positive, 2); assert.equal(q.negative, 2 / 3);
      assert.ok(!/[\u0900-\u097f]/u.test(q.question + q.explanation + Object.values(q.options).join(' ')), 'English content only');
      assert.ok(!/[\ue000-\uf8ff]/u.test(q.question + q.explanation + Object.values(q.options).join(' ')), 'Convert private PDF font glyphs to readable text');
      const fingerprint = JSON.stringify([q.question, ...Object.values(q.options)].map(s => s.toLowerCase().replace(/\s+/g, ' ').trim()));
      assert.ok(!fingerprints.has(fingerprint), 'Repeated question'); fingerprints.add(fingerprint);
    }
    assert.equal(t.recall?.kind, 'recall'); assert.equal(t.recall.items.length, 50);
    for (const [i, item] of t.recall.items.entries()) {
      assert.equal(item.number, i + 1); assert.ok(item.title?.trim() && item.text?.trim(), 'Incomplete recall entry');
    }
  }
  return tests;
}

const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
export function campSeedSQL(input) {
  const tests = validateCampTests(input);
  return 'begin;\n' + tests.map(t => `
do $camp_import$
declare
  payload jsonb := ${quote(JSON.stringify(t))}::jsonb;
  prior mock_private.tests%rowtype;
  import_test_id uuid;
  coach_id uuid;
begin
  select id into coach_id from mock_private.coaching where canonical_name='VAJIRAM & RAVI';
  if coach_id is null then raise exception 'Vajiram coaching entry is missing'; end if;
  select * into prior from mock_private.tests where code=payload->>'code' for update;
  if found then
    if prior.questions is distinct from payload->'questions' or prior.syllabus is distinct from payload->>'syllabus'
      or prior.coaching_id is distinct from coach_id or prior.question_count<>50 then
      raise exception 'CAMP code already contains different content; use a reviewed new version';
    end if;
    import_test_id := prior.id;
  else
    insert into mock_private.tests(code,name,coaching_id,series,year,paper,kind,subjects,topics,syllabus,difficulty,duration,positive,negative,status,listed,questions,question_count,maximum)
    values(payload->>'code',payload->>'name',coach_id,payload->>'series',2026,'GS-I','Sectional',array['Polity'],
      array(select distinct q->>'topic' from jsonb_array_elements(payload->'questions') q order by 1),
      payload->>'syllabus','Moderate',60,2,2.0/3.0,'active',true,payload->'questions',50,100)
    returning id into import_test_id;
  end if;
  if exists(select 1 from mock_private.report_documents d where d.test_id=import_test_id and kind='recall' and items is distinct from payload->'recall'->'items') then
    raise exception 'Existing recall content differs; no saved content was overwritten';
  end if;
  insert into mock_private.report_documents(test_id,kind,title,items)
    values(import_test_id,'recall',payload->'recall'->>'title',payload->'recall'->'items') on conflict do nothing;
end;
$camp_import$;
`).join('\n') + '\ncommit;\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [output, ...files] = process.argv.slice(2);
  assert.ok(output && files.length, 'Usage: node seed-camp-tests.mjs OUTPUT.sql PT-02.json [PT-03.json ...]');
  const tests = files.map(file => JSON.parse(readFileSync(file, 'utf8')));
  writeFileSync(output, campSeedSQL(tests));
  console.log(JSON.stringify({ tests: tests.length, questions: tests.reduce((n, t) => n + t.questions.length, 0), recallEntries: tests.reduce((n, t) => n + t.recall.items.length, 0) }));
}
