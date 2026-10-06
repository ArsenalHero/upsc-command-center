import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { campSeedSQL, validateCampTests } from '../scripts/seed-camp-tests.mjs';
import { fixtureLicense, prepareMockDatabase, setMockUser } from './mock-license-fixture';

function paper(n: number) {
  return { code: `CAMP-2026-PT-${String(n).padStart(2, '0')}`, name: `CAMP fixture ${n}`, series: 'Prelims CAMP 2026', year: 2026, paper: 'GS-I', kind: 'Sectional', duration: 60, positive: 2, negative: 2 / 3,
    syllabus: 'Full syllabus: Constitutional rights, institutions, legislative procedures, judicial review and the scheduled topic-specific provisions.',
    sourceHashes: Object.fromEntries(['questions', 'explanations', 'recall'].map(s => [s, 'a'.repeat(64)])),
    questions: Array.from({ length: 50 }, (_, i) => ({ id: `00000000-0000-5000-8000-${String(n * 100 + i).padStart(12, '0')}`, number: i + 1, question: `Question ${n}.${i + 1}: which constitutional principle is stated?`, options: { a: 'First principle', b: 'Second principle', c: 'Third principle', d: 'Fourth principle' }, correct: 'a', explanation: `Complete supplied explanation ${n}.${i + 1}: the first principle applies here; the other three choices refer to distinct principles.`, subject: 'Polity', topic: `Topic ${n}`, difficulty: 'Moderate', positive: 2, negative: 2 / 3 })),
    recall: { kind: 'recall', title: `Recall Sheet · PT-${String(n).padStart(2, '0')}`, items: Array.from({ length: 50 }, (_, i) => ({ number: i + 1, title: `Recall ${n}.${i + 1}`, text: `The entire recall entry for question ${i + 1} is preserved, including its punctuation and complete wording.` })) } };
}
const imported = process.env.CAMP_IMPORT_DIR
  ? [2, 3, 4, 5].map(n => JSON.parse(readFileSync(`${process.env.CAMP_IMPORT_DIR}/pt0${n}.json`, 'utf8')))
  : [paper(2), paper(3), paper(4), paper(5)];

test('CAMP loading refuses incomplete papers, missing recall entries, repeated questions and cross-test IDs', () => {
  validateCampTests(imported);
  const missing = structuredClone(imported); missing[0].questions.pop(); assert.throws(() => validateCampTests(missing));
  const recall = structuredClone(imported); recall[0].recall.items[0].number = 50; assert.throws(() => validateCampTests(recall));
  const repeat = structuredClone(imported); repeat[0].questions[1] = { ...repeat[0].questions[0], id: repeat[0].questions[1].id, number: 2 }; assert.throws(() => validateCampTests(repeat), /Repeated question/);
  const ids = structuredClone(imported); ids[1].questions[0].id = ids[0].questions[0].id; assert.throws(() => validateCampTests(ids), /IDs/);
});

test('all four CAMP imports are atomic, repeatable and keep previous papers, answers, explanations and protected recall', async () => {
  const db = new PGlite(), owner = '77777777-7777-4777-8777-777777777777', stranger = '88888888-8888-4888-8888-888888888888';
  try {
    await prepareMockDatabase(db, [{ id: owner }, { id: stranger }]);
    await db.exec("insert into mock_private.coaching(canonical_name,display_name) values('VAJIRAM & RAVI',mock_private.reverse_name('VAJIRAM & RAVI'))");
    await db.exec(campSeedSQL([paper(1)]));
    const api = async (op: string, p: unknown = {}) => (await db.query<{ data: any }>('select public.mock_lab($1,$2::jsonb) data', [op, JSON.stringify(p)])).rows[0].data;
    await setMockUser(db, owner); await api('verify-license', { licenseKey: fixtureLicense }); await api('profile', { displayName: 'CampLearner' });
    const oldId = (await api('catalog')).tests[0].id, oldAttempt = await api('start', { testId: oldId });
    const oldDone = await api('submit', { attemptId: oldAttempt.id, sequence: 1, answers: { [oldAttempt.questions[0].id]: { option: 'a' } } });
    await db.exec('reset role');
    const oldRow = (await db.query('select to_jsonb(t) data from mock_private.tests t where id=$1', [oldId])).rows[0];
    await db.exec(campSeedSQL(imported)); await db.exec(campSeedSQL(imported));
    assert.deepEqual((await db.query('select to_jsonb(t) data from mock_private.tests t where id=$1', [oldId])).rows[0], oldRow);
    assert.equal((await db.query<{ n: number }>('select count(*)::integer n from mock_private.tests')).rows[0].n, 5);
    // A conflicting later paper rolls back earlier inserts in the same batch.
    const conflict = structuredClone(imported[0]); conflict.questions[0].explanation += ' Altered.';
    await assert.rejects(db.exec(campSeedSQL([paper(6), conflict])), /different content/); await db.exec('rollback');
    assert.equal((await db.query<{ n: number }>("select count(*)::integer n from mock_private.tests where code='CAMP-2026-PT-06'")).rows[0].n, 0);
    await setMockUser(db, null); await assert.rejects(api('catalog'), /Sign in/);
    await setMockUser(db, stranger); await assert.rejects(api('catalog'), /License verification/);
    await setMockUser(db, owner); assert.deepEqual((await api('attempt', { attemptId: oldAttempt.id })).result, oldDone.result);
    const catalog = await api('catalog'); assert.equal(catalog.tests.length, 5);
    for (const source of imported) {
      const t = catalog.tests.find((t: any) => t.code === source.code);
      assert.equal(t.question_count, 50); assert.equal(t.maximum, 100); assert.equal(t.duration, 60); assert.equal(t.syllabus, source.syllabus);
      const run = await api('start', { testId: t.id }); assert.equal(run.questions.length, 50);
      assert.ok(run.questions.every((q: any) => !q.correct && !q.explanation));
      for (const q of source.questions.filter((q: any) => q.blocks)) assert.deepEqual(run.questions.find((r: any) => r.id === q.id).blocks, q.blocks);
      await assert.rejects(api('report-document', { attemptId: run.id, kind: 'recall' }), /Submit/);
      const done = await api('submit', { attemptId: run.id, sequence: 1, answers: Object.fromEntries(source.questions.map((q: any) => [q.id, { option: q.correct }])) });
      assert.equal(done.result.score, 100); assert.equal(done.result.correct, 50); assert.equal(done.result.incorrect, 0);
      for (const q of source.questions) assert.equal(done.questions.find((r: any) => r.id === q.id).explanation, q.explanation);
      const recall = await api('report-document', { attemptId: run.id, kind: 'recall' }); assert.deepEqual(recall.items, source.recall.items);
      await setMockUser(db, stranger); await api('verify-license', { licenseKey: fixtureLicense }); await assert.rejects(api('report-document', { attemptId: run.id, kind: 'recall' }), /not found/); await setMockUser(db, owner);
    }
  } finally { await db.close(); }
});
