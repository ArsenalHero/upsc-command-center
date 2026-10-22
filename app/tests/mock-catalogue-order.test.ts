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
