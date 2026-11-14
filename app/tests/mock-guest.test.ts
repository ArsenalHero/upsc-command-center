import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { fixtureLicense, prepareMockDatabase, setMockUser } from "./mock-license-fixture";

test("guests can resume, submit and review private server-scored practice without an Auth account", async () => {
  const db = new PGlite(), admin = "11111111-1111-4111-8111-111111111111";
  const token = "ab".repeat(32), other = "cd".repeat(32), blocked = "ef".repeat(32);
  const api = async (op: string, p: Record<string, unknown> = {}) =>
    (await db.query<{ data: any }>("select public.mock_lab($1,$2::jsonb) data", [op, JSON.stringify(p)])).rows[0].data;
  const guest = (op: string, p: Record<string, unknown> = {}, secret = token) => api(op, { ...p, guestToken: secret });
  try {
    await prepareMockDatabase(db, [{ id: admin, admin: true }]);
    await setMockUser(db, admin);
    await api("verify-license", { licenseKey: fixtureLicense });
    await api("profile", { displayName: "Manager" });
    const testId = (await api("admin-test", {
      code: "GUEST-TEST", name: "Guest validation mock", paper: "GS-I", kind: "Sectional", year: 2027,
      duration: 30, positive: 2, negative: 0.5, status: "active",
      questions: ["Alpha", "Beta", "Gamma"].map(topic => ({
        question: `Which ${topic} choice is correct?`, options: { a: "One", b: "Two", c: "Three", d: "Four" },
        correct: "a", explanation: "This explanation is available after submission only.", subject: "Polity", topic,
      })),
    })).id;
    await setMockUser(db, null);
    assert.deepEqual(await guest("license-status"), { authorized: false });
    await assert.rejects(guest("catalog", { authorized: true }), /verify your license|License verification/);
    await assert.rejects(guest("verify-license", { licenseKey: fixtureLicense }, "short"), /Sign in/);
    for (let i = 0; i < 10; i++) assert.deepEqual(await guest("verify-license", { licenseKey: "wrong" }, blocked), { authorized: false });
    assert.ok((await guest("verify-license", { licenseKey: fixtureLicense }, blocked)).retryAfter > 0);
    assert.deepEqual(await guest("verify-license", { licenseKey: fixtureLicense }), { authorized: true });
    assert.deepEqual(await guest("license-status"), { authorized: true });
    assert.equal((await guest("catalog")).tests[0].id, testId);
    for (const op of ["admin-list", "admin-get", "admin-test", "admin-coaching"])
      await assert.rejects(guest(op, { testId, admin: true }), /Administrator/);
    for (const table of ["participants", "attempts", "profiles", "license_config"])
      await assert.rejects(db.query(`select * from mock_private.${table}`), /permission denied/);
    const attempt = await guest("start", { testId, mode: "official", eligible: true });
    assert.equal(attempt.mode, "practice");
    assert.equal(attempt.eligible, false);
    assert.equal((await guest("start", { testId })).id, attempt.id);
    assert.ok(!JSON.stringify(attempt).includes('"correct"'));
    assert.ok(!JSON.stringify(attempt).includes("explanation"));
    const ids = attempt.questions.map((q: any) => q.id);
    const answers = { [ids[0]]: { option: "a", visited: true }, [ids[1]]: { option: "b", visited: true } };
    await guest("save", { attemptId: attempt.id, answers, index: 1, sequence: 1 });
    const resumed = await guest("attempt", { attemptId: attempt.id });
    assert.equal(resumed.answers[ids[0]].option, "a");
    assert.equal(resumed.index, 1);
    await guest("verify-license", { licenseKey: fixtureLicense }, other);
    for (const op of ["attempt", "save", "submit", "annotate", "report-document"])
      await assert.rejects(guest(op, { attemptId: attempt.id }, other), /not found/);
    assert.deepEqual(await guest("history", {}, other), []);
    const done = await guest("submit", { attemptId: attempt.id, score: 9999, eligible: true });
    assert.equal(done.result.score, 1.5);
    assert.equal(done.result.correct, 1);
    assert.equal(done.result.incorrect, 1);
    assert.equal(done.result.unattempted, 1);
    assert.equal(done.position, null);
    assert.equal(done.questions[0].correct, "a");
    assert.equal((await guest("history"))[0].id, attempt.id);
    assert.equal((await guest("summary")).mocks, 1);
    assert.equal((await guest("leaderboard", { testId })).participants, 0);
    await guest("annotate", { attemptId: attempt.id, questionId: ids[1], note: "My guest note", bookmarked: true });
    assert.equal((await guest("notebook", { selection: "bookmarks" }))[0].question.response.note, "My guest note");
    await db.exec("reset role");
    assert.equal((await db.query<{ n: number }>("select count(*)::integer n from auth.users")).rows[0].n, 1, "No Auth accounts created for guests");
    const stored = (await db.query<{ hash: string }>("select encode(guest_token_hash,'hex') hash from mock_private.participants where guest_token_hash=sha256(convert_to($1,'UTF8'))", [token])).rows[0];
    assert.ok(stored.hash && stored.hash !== token);
    await db.exec("update mock_private.license_config set version=gen_random_uuid()");
    await setMockUser(db, null);
    assert.deepEqual(await guest("license-status"), { authorized: false });
    await assert.rejects(guest("attempt", { attemptId: attempt.id }), /License verification/);
    await guest("verify-license", { licenseKey: fixtureLicense });
    assert.equal((await guest("attempt", { attemptId: attempt.id })).result.score, 1.5);
    const timed = await guest("start", { testId });
    await db.exec("reset role");
    await db.query("update mock_private.attempts set deadline=now()-interval '1 second' where id=$1", [timed.id]);
    await setMockUser(db, null);
    const timedOut = await guest("submit", { attemptId: timed.id, sequence: 99,
      answers: Object.fromEntries(timed.questions.map((q: any) => [q.id, { option: "a" }])) });
    assert.equal(timedOut.status, "submitted");
    assert.equal(timedOut.result.score, 0, "Guest answers received after the deadline cannot change the score");
    await setMockUser(db, admin);
    await api("verify-license", { licenseKey: fixtureLicense });
    await assert.rejects(api("attempt", { attemptId: attempt.id, guestToken: token }), /not found/);
    const ranked = await api("start", { testId });
    assert.equal(ranked.eligible, true, "Account first attempts remain ranked");
    await api("submit", { attemptId: ranked.id });
    assert.equal((await api("leaderboard", { testId })).participants, 1);
    const expired = await api("start", { testId, mode: "practice" });
    await db.exec("reset role");
    await db.query("update mock_private.attempts set deadline=now()-interval '1 second' where id=$1", [expired.id]);
    await setMockUser(db, admin);
    assert.equal((await api("attempt", { attemptId: expired.id })).status, "submitted");
  } finally { await db.close(); }
});
