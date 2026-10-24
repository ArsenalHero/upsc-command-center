import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { fixtureLicense, prepareMockDatabase, setMockUser } from "./mock-license-fixture";

test("catalogue follows the schedule across pagination, filters and natural code fallbacks", async () => {
  const db = new PGlite(), admin = "11111111-1111-4111-8111-111111111111";
  const api = async (p: Record<string, unknown> = {}) =>
    (await db.query<{ data: any }>("select public.mock_lab('catalog',$1::jsonb) data", [JSON.stringify(p)])).rows[0].data;
  const codeList = (result: any) => result.tests.map((t: any) => t.code);
  try {
    await prepareMockDatabase(db, [{ id: admin, admin: true }]);
    // Insert in reverse order and give later schedule dates earlier upload times.
    for (let n = 15; n >= 1; n--) {
      await db.query(`insert into mock_private.tests(code,name,series,year,paper,kind,duration,positive,negative,status,
        scheduled_at,created_at,questions,question_count,maximum)
        values($1,$1,'Scheduled series',2026,$2,'Sectional',60,2,0.5,'active',
        timestamptz '2025-11-01 05:30:00+00'+$3*interval '1 day',now()-$3*interval '1 hour',$4::jsonb,1,2)`,
        [`MOCK-${n}`, n % 2 ? "GS-I" : "CSAT", n,
          JSON.stringify([{ id: `q${n}`, question: "A private question", correct: "a", explanation: "A private explanation" }])]);
    }
    for (const [code, year, schedule] of [
      ["UNDATED-10", 2026, null], ["UNDATED-2", 2026, null], ["UNDATED-1", 2026, null],
      ["LATEST-YEAR", 2027, null], ["OLDER-YEAR", 2025, "2025-01-01T00:00:00Z"],
    ] as const) {
      await db.query(`insert into mock_private.tests(code,name,series,year,paper,kind,duration,positive,negative,status,scheduled_at)
        values($1,$1,'Scheduled series',$2,'GS-I','Sectional',60,2,0.5,'active',$3)`, [code, year, schedule]);
    }
    await setMockUser(db, admin);
    await db.query("select public.mock_lab('verify-license',$1::jsonb)", [JSON.stringify({ licenseKey: fixtureLicense })]);
    const expected = ["LATEST-YEAR", ...Array.from({ length: 15 }, (_, i) => `MOCK-${i + 1}`),
      "UNDATED-1", "UNDATED-2", "UNDATED-10", "OLDER-YEAR"];
    const all = await api({ limit: 100 });
    assert.deepEqual(codeList(all), expected);
    const first = await api({ limit: 12, offset: 0 }), second = await api({ limit: 12, offset: 12 });
    assert.equal(first.tests.length, 13, "The thirteenth entry remains the next-page sentinel");
    assert.deepEqual([...codeList(first).slice(0, 12), ...codeList(second)], expected);
    const gs = await api({ year: "2026", paper: "GS-I", limit: 100 });
    assert.deepEqual(codeList(gs), [...Array.from({ length: 8 }, (_, i) => `MOCK-${2 * i + 1}`), "UNDATED-1", "UNDATED-2", "UNDATED-10"]);
    assert.ok(!JSON.stringify(all).includes("A private question"));
    assert.ok(!JSON.stringify(all).includes('"correct"'));
    await setMockUser(db, null);
    const guestToken = "ab".repeat(32);
    await db.query("select public.mock_lab('verify-license',$1::jsonb)", [JSON.stringify({ licenseKey: fixtureLicense, guestToken })]);
    assert.deepEqual(codeList(await api({ limit: 12, offset: 12, guestToken })), codeList(second));
  } finally { await db.close(); }
});

test("catalogue totals count every published mock and refresh independently of filters and pagination", async () => {
  const db = new PGlite(), account = "11111111-1111-4111-8111-111111111111";
  const api = async (op: string, p: Record<string, unknown> = {}) =>
    (await db.query<{ data: any }>("select public.mock_lab($1,$2::jsonb) data", [op, JSON.stringify(p)])).rows[0].data;
  try {
    await prepareMockDatabase(db, [{ id: account }]);
    await setMockUser(db, account);
    await assert.rejects(api("catalog-summary"), /License verification is required/);
    await api("verify-license", { licenseKey: fixtureLicense });
    assert.deepEqual(await api("catalog-summary"), { tests: 0, questions: 0 });
    await db.exec("reset role");
    await db.exec(`insert into mock_private.tests(code,name,year,paper,kind,status,listed,publish_at,question_count,series,duration,positive,negative)
      select v.*,'Totals fixture',120,2,2.0/3 from (values ('GS','GS',2027,'GS-I','Full Length','active',true,now(),100),
      ('CSAT','CSAT',2027,'CSAT','Full Length','closed',true,now(),80),
      ('OLD','OLD',2026,'GS-I','Sectional','archived',true,now(),40),
      ('DRAFT','DRAFT',2027,'GS-I','Full Length','draft',true,now(),100),
      ('HIDDEN','HIDDEN',2027,'GS-I','Full Length','active',false,now(),100),
      ('FUTURE','FUTURE',2027,'GS-I','Full Length','active',true,now()+interval '1 day',100)) v`);
    await setMockUser(db, account);
    assert.deepEqual(await api("catalog-summary", { paper: "CSAT", limit: 1, offset: 100, search: "missing" }), { tests: 3, questions: 220 });
    assert.equal((await api("catalog", { limit: 1 })).tests.length, 2);
    await setMockUser(db, null);
    const guestToken = "ac".repeat(32);
    await api("verify-license", { licenseKey: fixtureLicense, guestToken });
    assert.deepEqual(await api("catalog-summary", { guestToken }), { tests: 3, questions: 220 });
    await db.exec("reset role");
    await db.query("update mock_private.tests set question_count=200 where code='GS'");
    await setMockUser(db, null);
    assert.deepEqual(await api("catalog-summary", { guestToken }), { tests: 3, questions: 320 });
    await assert.rejects(api("catalog-summary"), /Sign in or verify your license key/);
  } finally { await db.close(); }
});
