import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { fixtureLicense, prepareMockDatabase, setMockUser } from "./mock-license-fixture";
import { aurumCount, aurumFingerprint, aurumPool, aurumPYQs, aurumSubject, chooseAurumQuestions, type AurumCandidate } from "../src/utils/aurum";
import type { PYQQuestion } from "../src/utils/pyq";

const migration = readFileSync(new URL("../supabase/migrations/20261104031926_aurum_subject_practice.sql", import.meta.url), "utf8");
const options = { a: "The first choice", b: "The second choice", c: "The third choice", d: "The fourth choice" };
const pyq = (id: string, subject = "Polity") => ({ origin: "pyq", sourceId: id, sourceLabel: "2025 GS-I", question: `Previous year question ${id}: which choice is correct?`, subject, topic: "Institutions", options, correct: "a", explanation: "The first choice follows from the premise." });

test("Aurum combines subjects/sources, deduplicates content and validates available counts", async () => {
  assert.equal(aurumSubject("Economics"), "Economy");
  assert.equal(aurumSubject("Science and Tech"), "Science & Technology");
  assert.equal(await aurumFingerprint(pyq("one")), await aurumFingerprint({ ...pyq("one"), question: pyq("one").question.toUpperCase() + "!", options: { a: options.d, b: options.b, c: options.a, d: options.c } }));
  const pool: AurumCandidate[] = await Promise.all(["a", "b", "c", "d"].map(async (id, i) => ({
    origin: i % 2 ? "mock" : "pyq", sourceId: id, fingerprint: await aurumFingerprint(pyq(id)),
    subject: i < 2 ? "Polity" : "Economy", subjects: [i < 2 ? "Polity" : "Economy"], sourceLabel: id,
    testId: "mock-test", question: pyq(id) as any,
  })));
  const withDuplicate = [...pool, { ...pool[0], origin: "mock" as const, sourceId: "other-id" }];
  assert.equal(aurumCount(withDuplicate), 4);
  assert.equal(aurumPool(withDuplicate, [], "pyq", ["Polity"]).length, 1);
  assert.equal(aurumPool(withDuplicate, [pool[0].fingerprint], "both", ["Polity"]).length, 1);
  const selected = chooseAurumQuestions(withDuplicate, 4, "both", () => .4);
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map(q => q.origin)).size, 2);
  for (const n of [0, -1, 1.5, 101, NaN]) assert.throws(() => chooseAurumQuestions(pool, n, "both"));
  assert.throws(() => chooseAurumQuestions(pool, 5, "both"), /enough fresh questions/);
  const bank = await aurumPYQs([
    { ...pyq("keyed"), id: "keyed", answer: "a", keyStatus: "official", stage: "Prelims", subjectMemberships: [{ subject: "Economics", topic: "Budget" }] },
    { ...pyq("pending"), id: "pending", answer: null, keyStatus: "pending", stage: "Prelims" },
    { ...pyq("mains"), id: "mains", answer: "a", keyStatus: "provided", stage: "Mains" },
  ] as unknown as PYQQuestion[]);
  assert.equal(bank.length, 1);
  assert.deepEqual(bank[0].subjects, ["Polity", "Economy"]);
});

test("Postgres Aurum keeps permanent, private, atomic reservations with hidden answers and resumable scoring", async () => {
  const db = new PGlite();
  const admin = "11111111-1111-4111-8111-111111111111", alice = "22222222-2222-4222-8222-222222222222", bob = "33333333-3333-4333-8333-333333333333";
  const api = async (op: string, p: unknown = {}) => (await db.query<{ data: any }>("select public.mock_lab($1,$2::jsonb) data", [op, JSON.stringify(p)])).rows[0].data;
  const as = async (id: string | null) => { await setMockUser(db, id); };
  const unlock = async (id: string) => { await as(id); await api("verify-license", { licenseKey: fixtureLicense }); };
  try {
    await prepareMockDatabase(db, [{ id: admin, admin: true }, { id: alice }, { id: bob }]);
    await db.exec(migration);
    await db.exec(migration); // Rerunning a migration never clears history or weakens access.
    await as(null);
    await assert.rejects(api("aurum-state"), /Sign in/);
    await as(alice);
    await assert.rejects(api("aurum-state"), /License verification/);
    await assert.rejects(db.query("select * from mock_private.aurum_seen"), /permission denied/);
    await assert.rejects(db.query("select mock_private.aurum_api('aurum-state','{}',$1)", [bob]), /permission denied/);
    await unlock(admin);
    const questions = ["Polity", "Economics", "Science and Technology"].map((subject, i) => ({ ...pyq(`mock-${i}`, subject), difficulty: "Moderate" }));
    const testId = (await api("admin-test", { code: "AURUM-1", name: "Aurum source paper", year: 2027, series: "Test", paper: "GS-I", kind: "Sectional", duration: 30, positive: 2, negative: .5, status: "active", questions })).id;
    await api("admin-test", { code: "AURUM-2", name: "Duplicate source", year: 2027, series: "Test", paper: "GS-I", kind: "Sectional", duration: 30, positive: 2, negative: .5, status: "active", questions: [{ ...questions[0], question: questions[0].question.toUpperCase() + "!", options: { a: options.d, b: options.c, c: options.b, d: options.a }, correct: "d" }] });
    await unlock(alice);
    const state = await api("aurum-state");
    assert.equal(state.mocks.length, 3, "Identical wording with shuffled options in another test is one question");
    assert.ok(!JSON.stringify(state).includes('"correct"'));
    assert.ok(state.mocks.some((q: any) => q.subject === "Economy"));
    const mock = state.mocks.find((q: any) => q.subject === "Polity");
    for (const count of [0, -1, 1.5, 101]) await assert.rejects(api("aurum-start", { requestId: crypto.randomUUID(), source: "pyq", subjects: ["Polity"], count, questions: [pyq("a")] }));
    await assert.rejects(api("aurum-start", { requestId: crypto.randomUUID(), source: "pyq", subjects: [], count: 1, questions: [pyq("a")] }), /subjects/);
    await assert.rejects(api("aurum-start", { requestId: crypto.randomUUID(), source: "mock", subjects: ["Polity"], count: 1, questions: [pyq("a")] }), /source/);
    await assert.rejects(api("aurum-start", { requestId: crypto.randomUUID(), source: "pyq", subjects: ["Geography"], count: 1, questions: [pyq("a")] }), /subject/);
    const duplicate = { ...pyq("cross-source"), question: questions[0].question };
    await assert.rejects(api("aurum-start", { requestId: crypto.randomUUID(), source: "both", subjects: ["Polity"], count: 2, questions: [mock, duplicate] }), /already used/);
    assert.equal((await api("aurum-state")).practised, 0, "A failed start reserves nothing");
    const requestId = crypto.randomUUID();
    const s = await api("aurum-start", { requestId, source: "both", subjects: ["Polity", "Economy"], count: 3, questions: [mock, pyq("p-one"), pyq("p-two", "Economy")] });
    assert.equal(s.questions.length, 3);
    assert.ok(!JSON.stringify(s.questions).includes('"correct"'));
    assert.ok(!JSON.stringify(s.questions).includes('"explanation"'));
    assert.equal((await api("aurum-start", { requestId: crypto.randomUUID() })).id, s.id, "Another tab resumes the one running session");
    assert.equal((await api("aurum-session", { sessionId: s.id })).id, s.id, "Reload resumes from the database");
    assert.equal((await api("aurum-state")).seen.length, 3);
    assert.equal((await api("aurum-state")).mocks.length, 2);
    await assert.rejects(api("aurum-answer", { sessionId: s.id, questionId: s.questions[0].id, option: "z" }), /valid answer/);
    const checked = await api("aurum-answer", { sessionId: s.id, questionId: s.questions[0].id, option: "a", correct: true });
    assert.ok(checked.questions[0].correct);
    assert.ok(!checked.questions[1].correct, "Only a checked question reveals its key");
    const again = await api("aurum-answer", { sessionId: s.id, questionId: s.questions[0].id, option: "b" });
    assert.equal(again.answers[s.questions[0].id].option, "a", "Checked answers cannot be changed on retry");
    await unlock(bob);
    assert.equal((await api("aurum-state")).seen.length, 0);
    await assert.rejects(api("aurum-session", { sessionId: s.id }), /not found/);
    await assert.rejects(api("aurum-answer", { sessionId: s.id, questionId: s.questions[0].id, option: "a" }), /not found/);
    await assert.rejects(api("aurum-finish", { sessionId: s.id }), /not found/);
    await as(alice);
    const wrong = await api("aurum-answer", { sessionId: s.id, questionId: s.questions[1].id, option: "b" });
    assert.equal(wrong.answers[s.questions[1].id].outcome, "incorrect");
    const done = await api("aurum-finish", { sessionId: s.id });
    assert.equal(done.status, "completed");
    assert.equal(done.summary.answered, 3);
    assert.equal(done.summary.skipped, 1);
    assert.equal((await api("aurum-start", { requestId })).id, s.id, "A lost start reply is idempotent after completion too");
    for (const question of [pyq("p-one"), { ...pyq("p-one"), question: "The same saved question with corrected wording?" }, { ...pyq("p-two", "Economy"), sourceId: "new-upload-id" }, duplicate]) {
      await assert.rejects(api("aurum-start", { requestId: crypto.randomUUID(), source: "pyq", subjects: ["Polity", "Economy"], count: 1, questions: [question] }), /already used/);
    }
    assert.equal((await api("history")).length, 0, "Aurum does not enter mock history or rankings");
    const remaining = (await api("aurum-state")).mocks;
    const nextRequest = { source: "mock", subjects: remaining.map((q: any) => q.subject), count: remaining.length, questions: remaining };
    const [next, concurrent] = await Promise.all([
      api("aurum-start", { ...nextRequest, requestId: crypto.randomUUID() }),
      api("aurum-start", { ...nextRequest, requestId: crypto.randomUUID() }),
    ]);
    assert.equal(next.id, concurrent.id, "Concurrent starts reserve only one set");
    await api("aurum-finish", { sessionId: next.id });
    assert.equal((await api("aurum-state")).mocks.length, 0, "Exhaustion never recycles old questions");
    await db.exec("reset role");
    assert.equal((await db.query<{ fp: string }>("select mock_private.aurum_fingerprint($1::jsonb) fp", [JSON.stringify(pyq("one"))])).rows[0].fp, await aurumFingerprint(pyq("one")));
  } finally { await db.close(); }
});

test("guest Aurum history survives revisits and stays isolated from other guests and accounts", async () => {
  const db = new PGlite(), guestToken = "a".repeat(64), otherToken = "b".repeat(64);
  const account = "11111111-1111-4111-8111-111111111111";
  const api = async (op: string, p: unknown = {}) => (await db.query<{ data: any }>("select public.mock_lab($1,$2::jsonb) data", [op, JSON.stringify(p)])).rows[0].data;
  try {
    await prepareMockDatabase(db, [{ id: account }]); await db.exec(migration); await setMockUser(db, null);
    await api("verify-license", { guestToken, licenseKey: fixtureLicense });
    const s = await api("aurum-start", { guestToken, requestId: crypto.randomUUID(), source: "pyq", subjects: ["Polity"], count: 1, questions: [pyq("guest")] });
    assert.equal((await api("aurum-state", { guestToken })).active.id, s.id);
    await api("verify-license", { guestToken: otherToken, licenseKey: fixtureLicense });
    assert.equal((await api("aurum-state", { guestToken: otherToken })).seen.length, 0);
    await assert.rejects(api("aurum-session", { guestToken: otherToken, sessionId: s.id }), /not found/);
    await setMockUser(db, account); await api("verify-license", { licenseKey: fixtureLicense });
    assert.equal((await api("aurum-state", { guestToken })).seen.length, 0);
    await setMockUser(db, null);
    assert.equal((await api("aurum-state", { guestToken })).seen.length, 1);
  } finally { await db.close(); }
});
