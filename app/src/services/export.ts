import type { AppData, Collection } from "../types";
import { validateData } from "./validation";
import { dateKey } from "../utils/date";
export function download(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export const exportJSON = (data: AppData) =>
  download(
    JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2),
    `upsc-backup-${dateKey()}.json`,
    "application/json",
  );
export async function parseBackup(file: File): Promise<AppData> {
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Backups must be smaller than 50 MB.");
  return validateData(JSON.parse(await file.text()));
}
export const csvCell = (value: unknown) => {
  let text =
    typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function buildCSV(data: AppData, collection: Collection): string {
  const rows = data[collection].map((r: any) => ({
    ...r,
    ...(collection === "pyqs" && r.attempt ? r.attempt : {}),
    ...(collection === "pyqs" && !r.year ? { year: "" } : {}),
    subject: r.subjectId
      ? data.subjects.find((s) => s.id === r.subjectId)?.name
      : "",
    topic: r.topicId ? data.topics.find((t) => t.id === r.topicId)?.name : "",
  }));
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    "\ufeff" +
    [
      keys.map(csvCell).join(","),
      ...rows.map((r) => keys.map((k) => csvCell((r as any)[k])).join(",")),
    ].join("\r\n")
  );
}
export const exportCSV = (data: AppData, c: Collection) =>
  download(
    buildCSV(data, c),
    `upsc-${c}-${dateKey()}.csv`,
    "text/csv;charset=utf-8;",
  );
