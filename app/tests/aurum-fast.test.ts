import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { fixtureLicense, prepareMockDatabase, setMockUser } from "./mock-license-fixture";
import { aurumSubjects, aurumQuestionSubject } from "../src/utils/aurum";

const options = { a: "First choice", b: "Second choice", c: "Third choice", d: "Fourth choice" };
const q = (id: string, subject: string) => ({ origin: "pyq", sourceId: id, sourceLabel: "Reviewed PYQ", subject, topic: "Foundations",
  question: `Question ${id}: which is the correct choice?`, options, correct: "a", explanation: "The first choice follows from the premise." });

test("indexed Aurum setup returns only compact counts, chooses trusted sets and keeps existing exclusions", async () => {
  const db = new PGlite(), owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
  const api = async (op: string, p: unknown = {}) => (await db.query<{ data: any }>("select public.mock_lab($1,$2::jsonb) data", [op, JSON.stringify(p)])).rows[0].data;
  try {
    await prepareMockDatabase(db, [{ id: owner, admin: true }, { id: other }]);
    await db.exec(readFileSync(new URL("../supabase/migrations/20261104031926_aurum_subject_practice.sql", import.meta.url), "utf8"));
    await setMockUser(db, owner); await api("verify-license", { licenseKey: fixtureLicense });
    const old = await api("aurum-start", { requestId: crypto.randomUUID(), source: "pyq", subjects: ["Polity"], count: 1, questions: [q("already-seen", "Polity")] });
    await api("aurum-finish", { sessionId: old.id });
    const testId = (await api("admin-test", { code: "FAST-MOCK", name: "Fast source", year: 2027, series: "Test", paper: "GS-I", kind: "Sectional", duration: 30, positive: 2, negative: .5, status: "active",
      questions: [q("overlap", "Polity"), q("mock-only", "Economy")] })).id;
    await db.exec("reset role");
    const migration = readFileSync(new URL("../supabase/migrations/20261104045009_aurum_fast_setup.sql", import.meta.url), "utf8");
    await db.exec(migration);
    for (const question of [q("already-seen", "Polity"), q("overlap", "Polity"), q("pyq-only", "Economy")]) {
      await db.query(`insert into mock_private.aurum_question_index(origin,source_id,fingerprint,subject,subjects,question)
        values('pyq',$1,mock_private.aurum_fingerprint($2::jsonb),$3,$4,$2::jsonb)`,
      [question.sourceId, JSON.stringify(question), question.subject, question.sourceId === "pyq-only" ? ["Economy", "Polity"] : [question.subject]]);
    }
    await db.exec(migration); // Backfill/trigger recreation is safe to repeat.
    await setMockUser(db, owner);
    const catalog = await api("aurum-catalog", { source: "both", subjects: ["Polity", "Economy"] });
    assert.equal(catalog.available, 3, "Repeated source copies count once across subjects and sources");
    assert.equal(catalog.sources.pyq, 2); assert.equal(catalog.sources.mock, 2);
    assert.equal(catalog.practised, 1); assert.equal(catalog.latest.id, old.id);
    for (const secret of ["fingerprint", "options", "correct", "question", "answers"]) {
      assert.equal(Object.hasOwn(catalog, secret), false);
      assert.equal(Object.hasOwn(catalog.latest, secret), false, "Session previews carry no question bodies or answers");
    }
    assert.ok(JSON.stringify(catalog).length < 2000, "Setup stays small as the question library grows");
    assert.equal((await api("aurum-catalog", { source: "pyq", subjects: ["Economy"] })).available, 1);
    await assert.rejects(api("aurum-catalog", { subjects: [null] }), /subjects/);
    await assert.rejects(db.query("select * from mock_private.aurum_question_index"), /permission denied/);
    await assert.rejects(db.query("select mock_private.aurum_fast_api('aurum-catalog','{}',$1)", [other]), /permission denied/);
    const request = { requestId: crypto.randomUUID(), source: "both", subjects: ["Polity", "Economy"], count: 3,
      questions: [{ ...q("injected", "Polity"), correct: "b" }] };
    const run = await api("aurum-start-v2", request);
    assert.equal(run.questions.length, 3); assert.equal(new Set(run.questions.map((q: any) => q.origin)).size, 2);
    assert.ok(!JSON.stringify(run.questions).includes('"correct"'));
    assert.ok(!JSON.stringify(run.questions).includes("injected"), "Selections and keys come from the server catalogue");
    assert.equal((await api("aurum-start-v2", request)).id, run.id);
    for (const question of run.questions) assert.notEqual(question.sourceId, "already-seen");
    await api("aurum-finish", { sessionId: run.id });
    assert.equal((await api("aurum-catalog", { source: "both", subjects: ["Polity", "Economy"] })).available, 0);
    await assert.rejects(api("aurum-start-v2", { ...request, requestId: crypto.randomUUID(), count: 1 }), /enough fresh/);
    await setMockUser(db, other); await assert.rejects(api("aurum-catalog"), /License/);
    await api("verify-license", { licenseKey: fixtureLicense });
    assert.equal((await api("aurum-catalog")).available, 4, "Another account gets its own availability");
    await setMockUser(db, owner);
    const updated = (await api("admin-test", { code: "NEW-INDEXED", name: "New source", year: 2027, series: "Test", paper: "GS-I", kind: "Sectional", duration: 30, positive: 2, negative: .5, status: "active", questions: [q("new-mock", "Geography")] })).id;
    assert.equal((await api("aurum-catalog", { source: "mock", subjects: ["Geography"] })).available, 1, "New tests are indexed automatically");
    await api("admin-test", { id: updated, action: "close" });
    assert.equal((await api("aurum-catalog", { source: "mock", subjects: ["Geography"] })).available, 0, "Closed tests vanish without stale cache counts");
    await db.exec("reset role"); await db.query("update mock_private.tests set scheduled_at=now()+interval '1 day' where id=$1", [testId]);
    await setMockUser(db, other);
    assert.equal((await api("aurum-catalog", { source: "mock" })).available, 0, "Future papers never leak through the index");
    await setMockUser(db, null); await assert.rejects(api("aurum-catalog"), /Sign in/);
  } finally { await db.close(); }
});

test("Aurum offers exactly seven ordered subjects and groups AMAC separately from modern history without resetting exclusions", async () => {
  const db = new PGlite(), owner = "11111111-1111-4111-8111-111111111111";
  const api = async (op: string, p: unknown = {}) => (await db.query<{data:any}>("select public.mock_lab($1,$2::jsonb) data",[op,JSON.stringify(p)])).rows[0].data;
  try {
    await prepareMockDatabase(db,[{id:owner,admin:true}]);
    for (const file of ["20261104031926_aurum_subject_practice.sql","20261104045009_aurum_fast_setup.sql"]) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
    const ancient={...q("ancient-pyq","History"),topic:"Ancient India"};
    const fixtures=[ancient,{...q("medieval-pyq","History"),topic:"Medieval India"},{...q("culture-pyq","Art & Culture"),topic:"Performing Arts"},
      {...q("modern-pyq","History"),topic:"Modern India · nationalism"},{...q("santhal-pyq","History & Culture"),topic:"Santhal Uprising"},q("excluded-environment","Environment")];
    for(const question of fixtures) await db.query(`insert into mock_private.aurum_question_index(origin,source_id,fingerprint,subject,subjects,question)
      values('pyq',$1,mock_private.aurum_fingerprint($2::jsonb),$3,$4,$2::jsonb)`,[question.sourceId,JSON.stringify(question),question.subject,[question.subject]]);
    await setMockUser(db,owner); await api("verify-license",{licenseKey:fixtureLicense});
    const old=await api("aurum-start",{requestId:crypto.randomUUID(),source:"pyq",subjects:["History"],count:1,questions:[ancient]});
    await api("aurum-finish",{sessionId:old.id});
    await api("admin-test",{code:"SUBJECTS",name:"Subject groups",year:2027,series:"Test",paper:"GS-I",kind:"Sectional",duration:30,positive:2,negative:.5,status:"active",questions:[
      {...q("ancient-mock","History"),topic:"Ancient History"},{...q("modern-mock","History"),topic:"Modern History"},q("culture-mock","Art and Culture"),q("environment-mock","Environment")
    ]});
    await db.exec("reset role");
    const migration=readFileSync(new URL("../supabase/migrations/20261104060906_aurum_subject_choices.sql",import.meta.url),"utf8");
    await db.exec(migration); await db.exec(migration);
    await setMockUser(db,owner);
    const catalog=await api("aurum-catalog");
    assert.deepEqual(catalog.subjects.map((s:any)=>s.name),[...aurumSubjects]);
    assert.equal(catalog.practised,1); assert.equal(catalog.latest.id,old.id);
    assert.equal(catalog.subjects.find((s:any)=>s.name==="AMAC").both,4);
    assert.equal(catalog.subjects.find((s:any)=>s.name==="Modern History").both,3);
    assert.equal(catalog.available,7,"Unrequested subjects and previously reserved questions do not enter availability");
    const amac=await api("aurum-start-v2",{requestId:crypto.randomUUID(),source:"both",subjects:["AMAC"],count:4});
    assert.ok(amac.questions.every((q:any)=>q.subject==="AMAC"));
    assert.equal(new Set(amac.questions.map((q:any)=>q.origin)).size,2);
    assert.ok(amac.questions.every((q:any)=>q.sourceId!==ancient.sourceId));
    await api("aurum-finish",{sessionId:amac.id});
    const modern=await api("aurum-start-v2",{requestId:crypto.randomUUID(),source:"both",subjects:["Modern History"],count:3});
    assert.ok(modern.questions.every((q:any)=>q.subject==="Modern History"));
    await api("aurum-finish",{sessionId:modern.id});
    await assert.rejects(api("aurum-start-v2",{requestId:crypto.randomUUID(),source:"both",subjects:["Environment"],count:1}),/Choose Polity/);
    for(const [subject,topic] of [["History","Ancient India"],["History","Modern India"],["History & Culture","Bhakti composers"],["Art and Culture","Performing Arts"]]) {
      await db.exec("reset role");
      const sql=(await db.query<{subject:string}>("select mock_private.aurum_question_subject($1::jsonb) as subject",[JSON.stringify({subject,topic})])).rows[0].subject;
      assert.equal(sql,aurumQuestionSubject(subject,topic));
    }
  } finally { await db.close(); }
});
