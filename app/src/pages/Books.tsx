import { useState, type CSSProperties, type FormEvent } from "react";
import { BookOpen, CheckCircle2, Download, ExternalLink, Library, Pencil, Plus, RotateCcw, Target, Trash2 } from "lucide-react";
import { useData } from "../hooks/useData";
import { DashboardCard, Modal, PageHeader, ProgressBar, ProgressRing } from "../components/ui";
import type { BookLog, BookPlan, BookWorkspace } from "../types";
import { dateKey, number, prettyDate, uid } from "../utils/date";
import { bookStats, buildBookCSV, emptyBooks, formatChapters, parseChapters } from "../utils/books";
import { bookSuggestions, type BookSuggestion } from "../data/bookSuggestions";
import { download, exportJSON } from "../services/export";
import { validateBooks } from "../services/validation";

export default function Books() {
  const { data, saveBooks } = useData();
  const workspace = data.books || emptyBooks();
  const [subject, setSubject] = useState("");
  const [form, setForm] = useState<{ book?: BookPlan; suggestion?: BookSuggestion }>();
  const [entry, setEntry] = useState<{ bookId?: string; kind?: BookLog["kind"]; log?: BookLog }>();
  const [deleting, setDeleting] = useState<{ book?: BookPlan; log?: BookLog }>();
  const [allHistory, setAllHistory] = useState(false);
  const stats = bookStats(workspace, subject);
  const ids = new Set(stats.books.map(b => b.id));
  const history = workspace.logs.filter(l => ids.has(l.bookId)).map((l, order) => ({ ...l, order })).sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  const subjects = data.subjects.filter(s => workspace.plans.some(b => b.subjectId === s.id));
  const suggestions = bookSuggestions.filter(s => !subject || data.subjects.find(x => x.id === subject)?.name.toLowerCase().startsWith(s.subject.toLowerCase()));
  const usedSuggestion = (s: BookSuggestion) => workspace.plans.some(p => p.title.toLowerCase() === s.title.toLowerCase() && p.author.toLowerCase() === s.author.toLowerCase());
  return <div className="books-workspace">
    <PageHeader eyebrow="WORKSPACE · READING & REVISION" title="Books" description="Track your chapters, see what is left, and make every revision count." action={<div className="book-actions"><button className="btn secondary" disabled={!workspace.plans.length} onClick={() => setEntry({})}><CheckCircle2 size={17} />Log chapter progress</button><button className="btn primary" onClick={() => setForm({})}><Plus size={17} />Add book</button></div>} />
    <div className="book-toolbar"><span><BookOpen size={17} />Your personal reading shelf</span><label>Subject<select aria-label="Book subject filter" value={subject} onChange={e => setSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label></div>
    <div className="stats-grid four book-kpis"><DashboardCard title="Books tracked" value={stats.books.length} detail={`${stats.finishedBooks} fully read`} icon={<Library size={18} />} /><DashboardCard title="Chapters completed" value={number(stats.completed)} detail={`Of ${number(stats.total)} total chapters`} tone="green" icon={<CheckCircle2 size={18} />} /><DashboardCard title="Chapters remaining" value={number(stats.remaining)} detail="For your first reading" tone="amber" icon={<BookOpen size={18} />} /><DashboardCard title="Chapter reviews" value={number(stats.chapterReviews)} detail="Each chapter × times revised" tone="purple" icon={<RotateCcw size={18} />} /></div>
    <section className="card book-overview"><div className="book-ring-area"><ProgressRing value={stats.progress} size={120} label={`${Math.round(stats.progress)}% of all book chapters completed`} /><div><span className="eyebrow">YOUR READING PROGRESS</span><h2>{Math.round(stats.progress)}% completed</h2><p>{stats.total ? `${stats.completed} chapters read · ${stats.remaining} to go` : "Add a book to start building your reading progress."}</p><span className="small muted">Chapter completion is counted once, even if you log it again.</span></div></div><div className="book-revision-overview"><div className="book-section-title"><span><RotateCcw size={17} />Revision goals</span><strong>{Math.round(stats.revisionProgress)}%</strong></div><ProgressBar value={stats.revisionProgress} color="purple" label="Overall book revision target" detail={stats.reviewTarget ? `${Math.round(stats.revisionProgress)}% of your target` : "Set a target on a book"} /><p>Each chapter has its own revision count. Extra reviews of one chapter keep the other chapters' targets unchanged.</p></div></section>
    <div className="book-section-title book-shelf-heading"><div><span className="eyebrow">ONE CHAPTER AT A TIME</span><h2>My bookshelf</h2></div><button className="text-btn" onClick={() => setForm({})}><Plus size={16} />Add a book</button></div>
    {!stats.books.length ? <section className="card book-empty"><span className="book-empty-icon"><BookOpen size={30} /></span><h3>{subject ? "No books in this subject yet." : "Your next chapter starts here."}</h3><p>Add your own book or choose a suggestion below. Enter completed chapters as <strong>1,2,3</strong> or <strong>1-4,7</strong>.</p><button className="btn primary" onClick={() => setForm({})}><Plus size={16} />Add your first book</button></section> : <div className="book-shelf">{stats.books.map(b => {
      const s = data.subjects.find(s => s.id === b.subjectId)!;
      return <article className="card book-card" key={b.id} style={{ "--book-color": s.color } as CSSProperties} aria-label={`${b.title} reading tracker`}>
        <div className="book-card-head"><span className="book-spine"><BookOpen size={22} /></span><div><span className="book-subject">{s.name}</span><h3>{b.title}</h3><p>{[b.author, b.edition].filter(Boolean).join(" · ") || "Your personal book"}</p></div><div className="book-card-controls"><button className="icon-btn" aria-label={`Edit book ${b.title}`} onClick={() => setForm({ book: b })}><Pencil size={15} /></button><button className="icon-btn" aria-label={`Delete book ${b.title}`} onClick={() => setDeleting({ book: b })}><Trash2 size={15} /></button></div></div>
        <div className="book-card-progress"><ProgressRing value={b.progress} size={84} color="var(--book-color)" label={`${b.title}: ${Math.round(b.progress)}% read`} /><div><strong>{b.completed}<span> / {b.totalChapters} chapters</span></strong><p>{b.remaining ? `${b.remaining} chapters remaining` : "First reading complete"}</p><span className={`badge ${b.remaining ? "blue" : "green"}`}>{Math.round(b.progress)}% completed</span></div></div>
        <div className="book-revision-stats"><div><strong>{b.fullRevisions}<span>{b.revisionTarget ? ` / ${b.revisionTarget}` : ""}</span></strong><small>full book revisions</small></div><div><strong>{b.revisedChapters}<span> / {b.totalChapters}</span></strong><small>chapters revised</small></div><div><strong>{b.chapterReviews}</strong><small>chapter reviews</small></div></div>
        <ProgressBar value={b.revisionProgress} color="purple" label={`${b.title} revision goal`} detail={b.revisionTarget ? `${Math.round(b.revisionProgress)}% · ${b.revisionTarget} per chapter` : "No revision target"} />
        <details className="book-chapter-details"><summary>Chapter map <span>{formatChapters(b.chapters.filter(c => c.read).map(c => c.number)) || "No chapters read yet"}</span></summary><div className="book-chapter-legend"><span><i className="unread" />Unread</span><span><i className="read" />Read</span><span><i className="revised" />Revised</span></div><div className="book-chapter-map" role="list" aria-label={`${b.title} chapter map`}>{b.chapters.map(c => <span role="listitem" key={c.number} className={c.revisions ? "revised" : c.read ? "read" : "unread"} title={`Chapter ${c.number}: ${c.read ? "read" : "unread"}, revised ${c.revisions} times`} aria-label={`Chapter ${c.number}: ${c.read ? "read" : "unread"}, revised ${c.revisions} times`}>{c.number}{c.revisions > 0 && <small>{c.revisions}×</small>}</span>)}</div></details>
        <div className="book-card-actions"><button className="btn secondary" aria-label={`Log reading for ${b.title}`} onClick={() => setEntry({ bookId: b.id, kind: "reading" })}><CheckCircle2 size={16} />Log reading</button><button className="btn secondary" aria-label={`Log revision for ${b.title}`} disabled={!b.completed} onClick={() => setEntry({ bookId: b.id, kind: "revision" })}><RotateCcw size={16} />Log revision</button></div>
      </article>;
    })}</div>}
    <section className="card book-history"><div className="book-section-title"><div><span className="eyebrow">YOUR READING RECORD</span><h2>Progress history</h2></div>{history.length > 6 && <button className="text-btn" onClick={() => setAllHistory(!allHistory)}>{allHistory ? "Show recent" : `Show all ${history.length}`}</button>}</div>{!history.length ? <p className="book-history-empty">Reading and revision entries will appear here. You can edit an entry to correct its chapters or revision count.</p> : (allHistory ? history : history.slice(0, 6)).map(l => {
      const b = workspace.plans.find(b => b.id === l.bookId)!;
      return <div className="book-log-row" key={l.id}><span className={`book-log-icon ${l.kind}`}>{l.kind === "reading" ? <BookOpen size={17} /> : <RotateCcw size={17} />}</span><div className="book-log-content"><strong>{b.title}</strong><p>{l.kind === "reading" ? "Read" : `Revised ${l.repeats}×`} · Chapters {formatChapters(l.chapters)}{l.notes && <span className="book-log-notes">{l.notes}</span>}</p></div><time dateTime={l.date}>{prettyDate(l.date)}</time><button className="icon-btn" aria-label={`Edit book entry ${l.id}`} onClick={() => setEntry({ log: l })}><Pencil size={15} /></button><button className="icon-btn" aria-label={`Delete book entry ${l.id}`} onClick={() => setDeleting({ log: l })}><Trash2 size={15} /></button></div>;
    })}<div className="book-export"><button className="text-btn" onClick={() => download(buildBookCSV(data), `upsc-books-${dateKey()}.csv`, "text/csv;charset=utf-8;")}><Download size={15} />Export book CSV</button><button className="text-btn" onClick={() => exportJSON(data)}>Back up workspace</button></div></section>
    <section className="book-suggestions"><div className="book-section-title"><div><span className="eyebrow">BUILD YOUR READING LIST</span><h2>Suggested UPSC books</h2></div><span className="badge blue">NCERT + subject references</span></div><p className="book-suggestion-intro">Start with foundations, then choose a reference for the subjects you need. These are study suggestions from this app. Check the chapter total against your edition before adding a book.</p><div className="book-suggestion-grid">{suggestions.map(s => <article className="card book-suggestion" key={s.id}><div className="book-suggestion-tags"><span className="badge">{s.subject}</span><span className={`badge ${s.free ? "green" : "purple"}`}>{s.free ? "Free NCERT PDF" : s.kind}</span></div><h3>{s.title}</h3><span className="book-suggestion-author">{s.author}</span><p>{s.description}</p><div className="book-suggestion-foot"><a href={s.url} target="_blank" rel="noreferrer">{s.source}<ExternalLink size={12} /></a><button className="text-btn" aria-label={`Add suggested book ${s.title}`} disabled={usedSuggestion(s)} onClick={() => setForm({ suggestion: s })}>{usedSuggestion(s) ? <><CheckCircle2 size={14} />Added</> : <><Plus size={14} />Add to shelf</>}</button></div></article>)}</div>{!suggestions.length && <p className="small muted">Add your own books for this subject, or choose All subjects to browse the suggested list.</p>}</section>
    {form && <BookForm book={form.book} suggestion={form.suggestion} close={() => setForm(undefined)} />}
    {entry && <ProgressForm {...entry} close={() => setEntry(undefined)} />}
    {deleting && <DeleteProgress workspace={workspace} selection={deleting} close={() => setDeleting(undefined)} save={saveBooks} />}
  </div>;
}

function BookForm({ book, suggestion, close }: { book?: BookPlan; suggestion?: BookSuggestion; close: () => void }) {
  const { data, saveBooks } = useData();
  const [title, setTitle] = useState(book?.title || suggestion?.title || "");
  const [author, setAuthor] = useState(book?.author || suggestion?.author || "");
  const [edition, setEdition] = useState(book?.edition || "");
  const [subject, setSubject] = useState(book?.subjectId || data.subjects.find(s => suggestion && s.name.toLowerCase().startsWith(suggestion.subject.toLowerCase()))?.id || data.subjects[0]?.id || "");
  const [total, setTotal] = useState(book ? String(book.totalChapters) : "");
  const [target, setTarget] = useState(String(book?.revisionTarget ?? 3));
  const [chapters, setChapters] = useState("");
  const [repeats, setRepeats] = useState("0");
  const [date, setDate] = useState(dateKey);
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const p: BookPlan = { id: book?.id || uid(), title: title.trim(), author: author.trim(), edition: edition.trim(), subjectId: subject, totalChapters: Number(total), revisionTarget: Number(target) };
      const w = data.books || emptyBooks();
      const logs = [...w.logs];
      if (!book) {
        const completed = parseChapters(chapters, p.totalChapters, true), times = Number(repeats);
        if (!Number.isInteger(times) || times < 0 || times > 1000) throw new Error("Already revised must be a whole number from 0 to 1,000.");
        if (times && !completed.length) throw new Error("Enter the completed chapters that you have already revised.");
        if (completed.length) logs.push({ id: uid(), bookId: p.id, date, kind: "reading", chapters: completed, repeats: 1, notes: "Initial completed chapters" });
        if (times) logs.push({ id: uid(), bookId: p.id, date, kind: "revision", chapters: completed, repeats: times, notes: "Initial revision count" });
      }
      const next = { plans: book ? w.plans.map(b => b.id === book.id ? p : b) : [...w.plans, p], logs };
      validateBooks(next, new Set(data.subjects.map(s => s.id)));
      if (saveBooks(next)) close(); else setError("Progress could not be saved. Check the message and retry.");
    } catch (e) { setError((e as Error).message); }
  };
  return <Modal title={book ? "Edit book" : "Add book"} onClose={close}><form onSubmit={submit}><div className="modal-body"><p className="book-form-intro">Use the chapter total from your edition. {book ? "Correct reading and revision entries in Progress history." : "You can add chapters you have already finished, too."}</p><label>Book title<input aria-label="Book title" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Indian Polity" /></label><div className="form-grid"><label>Author / publisher<input aria-label="Book author" maxLength={120} value={author} onChange={e => setAuthor(e.target.value)} placeholder="Optional" /></label><label>Edition<input aria-label="Book edition" maxLength={120} value={edition} onChange={e => setEdition(e.target.value)} placeholder="e.g. 8th edition" /></label></div><label>Subject<select aria-label="Book subject" value={subject} onChange={e => setSubject(e.target.value)}>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="form-grid"><label>Total chapters<input aria-label="Total book chapters" type="number" required min={1} max={1000} step={1} value={total} onChange={e => setTotal(e.target.value)} placeholder="Your edition's total" /></label><label>Revision target per chapter<input aria-label="Book revision target" type="number" required min={0} max={50} step={1} value={target} onChange={e => setTarget(e.target.value)} /><small>0 means no revision target.</small></label></div>{!book && <fieldset className="book-backfill"><legend>Already started? Add your progress</legend><label>Completed chapters<input aria-label="Initial completed chapters" value={chapters} maxLength={20000} onChange={e => setChapters(e.target.value)} placeholder="1,2,3 or 1-4,7" /><small>Leave blank to start at zero. Repeated numbers are counted once.</small></label><div className="form-grid"><label>Already revised how many times?<input aria-label="Initial revision count" type="number" min={0} max={1000} step={1} value={repeats} onChange={e => setRepeats(e.target.value)} /><small>Applies to each completed chapter above.</small></label><label>Progress date<input aria-label="Initial book progress date" type="date" required max={dateKey()} value={date} onChange={e => setDate(e.target.value)} /></label></div></fieldset>}{error && <p className="book-form-error" role="alert">{error}</p>}</div><div className="modal-foot"><button className="btn secondary" type="button" onClick={close}>Cancel</button><button className="btn primary" type="submit">Save book</button></div></form></Modal>;
}

function ProgressForm({ bookId, kind: initialKind, log, close }: { bookId?: string; kind?: BookLog["kind"]; log?: BookLog; close: () => void }) {
  const { data, saveBooks } = useData();
  const w = data.books || emptyBooks();
  const [selected, setSelected] = useState(log?.bookId || bookId || w.plans[0]?.id || "");
  const [kind, setKind] = useState<BookLog["kind"]>(log?.kind || initialKind || "reading");
  const [chapters, setChapters] = useState(log ? formatChapters(log.chapters) : "");
  const [date, setDate] = useState(log?.date || dateKey());
  const [repeats, setRepeats] = useState(String(log?.repeats || 1));
  const [notes, setNotes] = useState(log?.notes || "");
  const [error, setError] = useState("");
  const book = w.plans.find(p => p.id === selected);
  const read = bookStats(w, "", date).books.find(p => p.id === selected)?.chapters.filter(c => c.read).map(c => c.number) || [];
  let preview: number[] = [], previewError = "";
  if (book && chapters.trim()) try { preview = parseChapters(chapters, book.totalChapters); } catch (e) { previewError = (e as Error).message; }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!book) throw new Error("Choose a book first.");
      const nextLog: BookLog = { id: log?.id || uid(), bookId: selected, date, kind, chapters: parseChapters(chapters, book.totalChapters), repeats: kind === "reading" ? 1 : Number(repeats), notes: notes.trim() };
      const next = { ...w, logs: log ? w.logs.map(l => l.id === log.id ? nextLog : l) : [...w.logs, nextLog] };
      validateBooks(next, new Set(data.subjects.map(s => s.id)));
      if (saveBooks(next)) close(); else setError("Progress could not be saved. Check the message and retry.");
    } catch (e) { setError((e as Error).message); }
  };
  return <Modal title={log ? "Edit chapter progress" : "Log chapter progress"} onClose={close}><form onSubmit={submit}><div className="modal-body"><label>Book<select aria-label="Progress book" value={selected} onChange={e => { setSelected(e.target.value); setChapters(""); setError(""); }}>{w.plans.map(p => <option value={p.id} key={p.id}>{p.title}</option>)}</select></label><div className="form-grid"><label>Activity<select aria-label="Book progress activity" value={kind} onChange={e => { setKind(e.target.value as BookLog["kind"]); setError(""); }}><option value="reading">First reading</option><option value="revision">Revision</option></select></label><label>Date<input aria-label="Book progress date" type="date" required max={dateKey()} value={date} onChange={e => setDate(e.target.value)} /></label></div><label>{kind === "reading" ? "Chapters completed" : "Chapters revised"}<input aria-label="Book progress chapters" required value={chapters} maxLength={20000} onChange={e => setChapters(e.target.value)} placeholder="1,2,3 or 1-4,7" /><small>Combine ranges and numbers, for example 1-4,7,9-12. Total: {book?.totalChapters || 0} chapters.</small></label>{kind === "revision" && <><button type="button" className="text-btn book-fill-read" disabled={!read.length} onClick={() => setChapters(formatChapters(read))}>Use all chapters read by this date</button><label>Times revised for each selected chapter<input aria-label="Book revision times" required type="number" min={1} max={1000} step={1} value={repeats} onChange={e => setRepeats(e.target.value)} /><small>Use 1 for a new review. For earlier progress, enter how many reviews this entry represents.</small></label></>}{chapters.trim() && <p className={`book-chapter-preview ${previewError ? "invalid" : ""}`} aria-live="polite">{previewError || (kind === "reading" ? `${preview.length} chapters selected · ${preview.filter(n => !read.includes(n)).length} newly completed` : `${preview.length} chapters × ${repeats || 0} revisions = ${preview.length * Number(repeats)} chapter reviews`)}</p>}<label>Notes<textarea aria-label="Book progress notes" maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional: key concepts or chapters to revisit" /></label>{error && <p className="book-form-error" role="alert">{error}</p>}</div><div className="modal-foot"><button className="btn secondary" type="button" onClick={close}>Cancel</button><button className="btn primary" type="submit">Save chapter progress</button></div></form></Modal>;
}

function DeleteProgress({ workspace, selection, close, save }: { workspace: BookWorkspace; selection: { book?: BookPlan; log?: BookLog }; close: () => void; save: (w: BookWorkspace) => boolean }) {
  const { data } = useData();
  const [error, setError] = useState("");
  const remove = () => {
    const next = selection.book ? { plans: workspace.plans.filter(b => b.id !== selection.book!.id), logs: workspace.logs.filter(l => l.bookId !== selection.book!.id) } : { ...workspace, logs: workspace.logs.filter(l => l.id !== selection.log!.id) };
    try { validateBooks(next, new Set(data.subjects.map(s => s.id))); if (save(next)) close(); else setError("The change could not be saved. Retry when storage is available."); } catch (e) { setError((e as Error).message); }
  };
  return <Modal title={selection.book ? "Delete this book?" : "Delete this chapter entry?"} onClose={close}><div className="modal-body"><p>{selection.book ? `This removes ${selection.book.title} and its reading and revision entries from your shelf.` : "This removes this entry and recalculates your progress. Reading entries needed by saved revisions must stay until those revisions are corrected."}</p>{error && <p role="alert" className="book-form-error">{error}</p>}</div><div className="modal-foot"><button className="btn secondary" onClick={close}>Cancel</button><button className="btn danger" onClick={remove}>{selection.book ? "Delete book" : "Delete chapter entry"}</button></div></Modal>;
}
