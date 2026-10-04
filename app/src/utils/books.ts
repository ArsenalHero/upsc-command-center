import type { AppData, BookWorkspace } from "../types";
import { dateKey } from "./date";
import { csvCell } from "../services/export";

export const emptyBooks = (): BookWorkspace => ({ plans: [], logs: [] });

export function parseChapters(input: string, total: number, allowEmpty = false): number[] {
  if (!Number.isInteger(total) || total < 1 || total > 1000) throw new Error("Enter a total of 1–1,000 chapters first.");
  if (!input.trim()) {
    if (allowEmpty) return [];
    throw new Error("Enter chapter numbers, such as 1,2,3 or 1-4.");
  }
  if (input.length > 20000) throw new Error("The chapter list is too long.");
  const chapters = new Set<number>();
  for (const token of input.replace(/[–—]/g, "-").split(",")) {
    const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use chapter numbers separated by commas, or ranges such as 1-4. Example: 1-4,7,9-12.");
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (start < 1 || end > total || start > end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end))
      throw new Error(`Chapters must be between 1 and ${total}, with smaller numbers first in a range.`);
    for (let n = start; n <= end; n++) chapters.add(n);
  }
  return [...chapters].sort((a, b) => a - b);
}

export function formatChapters(chapters: number[]): string {
  const sorted = [...new Set(chapters)].sort((a, b) => a - b), parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    parts.push(start === sorted[i] ? String(start) : `${start}-${sorted[i]}`);
  }
  return parts.join(",");
}

export function bookStats(w: BookWorkspace, subjectId = "", anchor = dateKey()) {
  const books = w.plans.filter(p => !subjectId || p.subjectId === subjectId).map(p => {
    const logs = w.logs.filter(l => l.bookId === p.id && l.date <= anchor);
    const read = new Set(logs.filter(l => l.kind === "reading").flatMap(l => l.chapters));
    const revisionCounts = new Map<number, number>();
    for (const l of logs) if (l.kind === "revision") for (const n of l.chapters)
      revisionCounts.set(n, (revisionCounts.get(n) || 0) + l.repeats);
    const chapters = Array.from({ length: p.totalChapters }, (_, i) => ({ number: i + 1, read: read.has(i + 1), revisions: revisionCounts.get(i + 1) || 0 }));
    const chapterReviews = chapters.reduce((sum, c) => sum + c.revisions, 0);
    const fullRevisions = Math.min(...chapters.map(c => c.revisions));
    const reviewCredit = chapters.reduce((sum, c) => sum + Math.min(p.revisionTarget, c.revisions), 0);
    return { ...p, chapters, logs, completed: read.size, remaining: p.totalChapters - read.size,
      progress: 100 * read.size / p.totalChapters, chapterReviews, fullRevisions, reviewCredit,
      revisedChapters: chapters.filter(c => c.revisions > 0).length,
      revisionProgress: p.revisionTarget ? 100 * reviewCredit / (p.totalChapters * p.revisionTarget) : 0 };
  });
  const total = books.reduce((sum, p) => sum + p.totalChapters, 0), completed = books.reduce((sum, p) => sum + p.completed, 0);
  const reviewTarget = books.reduce((sum, p) => sum + p.totalChapters * p.revisionTarget, 0), reviewCredit = books.reduce((sum, p) => sum + p.reviewCredit, 0);
  return { books, total, completed, remaining: total - completed, progress: total ? 100 * completed / total : 0,
    finishedBooks: books.filter(p => p.remaining === 0).length,
    chapterReviews: books.reduce((sum, p) => sum + p.chapterReviews, 0), reviewTarget,
    revisionProgress: reviewTarget ? 100 * reviewCredit / reviewTarget : 0 };
}

export function buildBookCSV(data: AppData) {
  const w = data.books || emptyBooks(), rows: unknown[][] = [["Book", "Author", "Edition", "Subject", "Total chapters", "Completed chapters", "Reading %", "Revision target", "Full book revisions", "Chapter reviews", "Revision target %"]];
  for (const b of bookStats(w).books) rows.push([b.title, b.author, b.edition, data.subjects.find(s => s.id === b.subjectId)?.name || "", b.totalChapters, formatChapters(b.chapters.filter(c => c.read).map(c => c.number)), Math.round(b.progress * 100) / 100, b.revisionTarget, b.fullRevisions, b.chapterReviews, Math.round(b.revisionProgress * 100) / 100]);
  rows.push([], ["Date", "Book", "Activity", "Chapters", "Revision times for each chapter", "Notes"]);
  for (const l of [...w.logs].sort((a, b) => a.date.localeCompare(b.date))) rows.push([l.date, w.plans.find(p => p.id === l.bookId)?.title || "", l.kind, formatChapters(l.chapters), l.kind === "revision" ? l.repeats : "", l.notes]);
  return "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
