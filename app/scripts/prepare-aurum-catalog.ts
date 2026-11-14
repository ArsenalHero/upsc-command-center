import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAurumPYQs } from "../src/data/aurumBank";

// Produce bounded SQL upserts for an administrator to run after the fast-setup
// migration. This never changes learner history or exposes a new client writer.
const output = process.argv[2];
if (!output) throw Error("Pass an output directory for the catalogue SQL batches.");
mkdirSync(output, { recursive: true });
const bank = await loadAurumPYQs();
const rows = bank.map(q => ({ origin: "pyq", source_id: q.sourceId, fingerprint: q.fingerprint,
  subject: q.subject, subjects: q.subjects, question: q.question }));
const paths: string[] = [];
const batchSize = 500;
for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  const json = JSON.stringify(batch).replaceAll("'", "''");
  const sql = `insert into mock_private.aurum_question_index(origin,source_id,fingerprint,subject,subjects,question)
select origin,source_id,fingerprint,subject,subjects,question from jsonb_to_recordset('${json}'::jsonb)
as x(origin text,source_id text,fingerprint text,subject text,subjects text[],question jsonb)
on conflict(origin,source_id) do update set fingerprint=excluded.fingerprint,subject=excluded.subject,subjects=excluded.subjects,question=excluded.question;
select count(*)::integer as pyq_rows from mock_private.aurum_question_index where origin='pyq';\n`;
  const file = resolve(output, `aurum-seed-${String(paths.length + 1).padStart(2, "0")}.sql`);
  writeFileSync(file, sql); paths.push(file);
}
writeFileSync(resolve(output, "manifest.json"), JSON.stringify({ questions: rows.length, batches: paths }, null, 2));
console.log(JSON.stringify({ questions: rows.length, batches: paths.length, output: resolve(output) }));
