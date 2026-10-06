import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PYQQuestion } from "../utils/pyq";
import { archivedPapers, archivedPaperQuestions, newPaperAttempt, paperAnswerLabel, paperOutcome, paperScore, readPaperAttempts, type ArchivedPaper, type PaperAttempt } from "../utils/paperArchive";
import { QuestionText } from "./QuestionText";
import "../paper-archive.css";

const fmt = (n: number) => Number(n.toFixed(2)).toString();
const clock = (n: number) => `${Math.floor(Math.max(0, n) / 3600).toString().padStart(2, "0")}:${Math.floor(Math.max(0, n) / 60 % 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, n) % 60).toString().padStart(2, "0")}`;
export default function PaperArchive({ renderExplanation, storageScope = "guest", timed = true }: {
  renderExplanation: (q: PYQQuestion) => ReactNode; storageScope?: string; timed?: boolean;
}) {
  const storageKey = `upsc-cse-paper-archive:v1:${storageScope}`;
  const [initial] = useState(() => {
    try { return { runs: readPaperAttempts(localStorage.getItem(storageKey)), canSave: true }; }
    catch { return { runs: [] as PaperAttempt[], canSave: false }; }
  });
  const [runs, setRuns] = useState(initial.runs), [selected, setSelected] = useState<string>(), [runId, setRunId] = useState<string>();
  const [year, setYear] = useState(""), [view, setView] = useState<"paper" | "study">("paper"), [query, setQuery] = useState("");
  const [tick, setTick] = useState(Date.now()), [finishPrompt, setFinishPrompt] = useState(false);
  const workspace = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState(initial.canSave ? "" : "Browser storage is unavailable or saved paper progress could not be read. Download a backup to keep your answers from this visit.");
  const paper = archivedPapers.find(p => p.id === selected), attempt = runs.find(r => r.id === runId);
  const notes = useMemo(() => paper ? archivedPaperQuestions(paper) : [], [paper]);
  const visibleNotes = notes.filter(q => `${q.subject} ${q.topic} ${q.question} ${Object.values(q.options).join(" ")} ${q.blocks?.filter(b => b.type === "passage").map(b => b.text).join(" ")} ${q.explanation?.justification || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    if (selected) workspace.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [selected, view]);

  const commit = (next: PaperAttempt[]) => {
    const kept = next.slice(-100);
    setRuns(kept);
    if (initial.canSave) try { localStorage.setItem(storageKey, JSON.stringify(kept)); }
    catch { setNotice("Your answers are kept for this visit. Browser storage is full or unavailable; download a backup before leaving."); }
  };
  const edit = (patch: Partial<PaperAttempt>) => {
    if (!attempt) return;
    if (!attempt.completedAt && attempt.deadline && Date.now() >= attempt.deadline) {
      commit(runs.map(r => r.id === attempt.id ? { ...r, completedAt: attempt.deadline } : r)); return;
    }
    commit(runs.map(r => r.id === attempt.id ? { ...r, ...patch } : r));
  };
  const complete = () => {
    if (!attempt || attempt.completedAt) return;
    edit({ completedAt: attempt.deadline ? Math.min(Date.now(), attempt.deadline) : Date.now() });
    setFinishPrompt(false);
  };
  useEffect(() => {
    if (!attempt || attempt.completedAt) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [attempt?.id, attempt?.completedAt]);
  useEffect(() => {
    if (attempt?.deadline && !attempt.completedAt && tick >= attempt.deadline) complete();
  }, [tick, attempt?.id]);

  const open = (p: ArchivedPaper, mode: PaperAttempt["mode"], reportId?: string) => {
    const draft = [...runs].reverse().find(r => r.paperId === p.id && !r.completedAt && r.keySha256 === p.keySha256);
    const next = reportId ? runs.find(r => r.id === reportId)! : draft || newPaperAttempt(p, mode, timed);
    if (!runs.some(r => r.id === next.id)) commit([...runs, next]);
    setSelected(p.id); setRunId(next.id); setView("paper"); setQuery(""); setFinishPrompt(false); setTick(Date.now());
  };
  const study = (p: ArchivedPaper) => { setSelected(p.id); setRunId(undefined); setView("study"); setQuery(""); };
  const back = () => { setSelected(undefined); setRunId(undefined); setFinishPrompt(false); setView("paper"); };
  const downloadBackup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "upsc-cse-paper-archive-v1", exportedAt: new Date().toISOString(), attempts: runs }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "upsc-cse-paper-answers.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const message = notice && <p className="paper-save-notice" role="status">{notice}</p>;

  if (paper && view === "study") return <section ref={workspace} className="paper-archive" aria-label="Paper explanations">
    <div className="paper-toolbar"><button className="btn secondary" onClick={() => attempt ? setView("paper") : back()}>← Back to {attempt ? "paper" : "full papers"}</button><span>{paper.year} · {paper.title}</span></div>
    <div className="paper-study-heading"><span className="eyebrow">QUESTIONS & EXPLANATIONS</span><h2>Explanations for {paper.year}</h2><p>{notes.length} questions in original booklet order, with explanations beside each question. Paper scoring uses the matching UPSC final key.</p></div>
    <label className="paper-note-search">Find a concept<input type="search" aria-label="Search paper explanations" placeholder="Search topic, subject or question…" value={query} onChange={e => setQuery(e.target.value)} /></label>
    {visibleNotes.map(q => <details className="card paper-study-note" key={q.id}><summary><span className="eyebrow">{q.subject} · {q.topic}</span><span>Q{q.number} · {q.question.split(/\n/)[0]}</span></summary><QuestionText q={q} /><ul className="supplied-options">{Object.entries(q.options).map(([key, value]) => <li key={key}><strong>{key.toUpperCase()}.</strong><span>{value}</span></li>)}</ul>{renderExplanation(q)}</details>)}
    {!visibleNotes.length && <p className="card">No explanations match this search.</p>}
  </section>;

  if (paper && attempt) {
    const n = attempt.current, question = archivedPaperQuestions(paper)[n - 1], key = attempt.keySnapshot[n - 1], choice = attempt.answers[String(n)] || "";
    const finished = !!attempt.completedAt, revealed = finished || attempt.mode === "practice" && attempt.revealed.includes(n);
    const locked = finished || revealed, outcome = paperOutcome(key, choice);
    const answered = Object.keys(attempt.answers).length, report = paperScore(paper, attempt);
    const remaining = attempt.deadline ? Math.max(0, (attempt.deadline - tick) / 1000) : undefined;
    const move = (current: number) => { if (current >= 1 && current <= paper.questionCount) edit({ current }); };
    return <section ref={workspace} className="paper-archive paper-reader" aria-label={`${paper.year} ${paper.title} workspace`}>
      <div className="paper-toolbar"><button className="btn secondary" onClick={back}>← Save & return to full papers</button><span>{finished ? "SAVED PAPER REPORT" : `${attempt.mode.toUpperCase()} · SERIES ${paper.booklet}`}</span><button className="btn secondary" onClick={downloadBackup}>Download answers</button></div>
      {message}
      <div className="paper-reader-heading"><div><span className="eyebrow">UPSC CIVIL SERVICES PRELIMS · {paper.year}</span><h2>{paper.title}</h2><p>{paper.questionCount} questions · Series {paper.booklet} · UPSC answer key</p></div>{!finished && <div className="paper-time"><span>{remaining === undefined ? "Elapsed time" : "Time remaining"}</span><strong aria-label="Paper timer">{clock(remaining ?? (tick - attempt.startedAt) / 1000)}</strong>{remaining !== undefined && <small>Deadline continues while away</small>}</div>}</div>
      {finished && <section className="card paper-scorecard" aria-label="Paper score"><div><span className="eyebrow">YOUR PRACTICE SCORE</span><h3>{fmt(report.score)}<small> / 200</small></h3><p>{report.correct} right · {report.incorrect} wrong · {report.skipped} skipped · {report.dropped} dropped</p></div><div><p>One-third penalty for wrong answers. Dropped items are excluded; this practice score is scaled to 200 over {report.scored} scored questions.</p>{paper.paper === "csat" && <strong>{report.score >= 66 ? "At or above" : "Below"} the 66/200 CSAT benchmark (33%).</strong>}<a href={`${paper.keyUrl}#page=${paper.keyPage}`} target="_blank" rel="noopener noreferrer">View the UPSC key · Series {paper.booklet} ↗</a></div></section>}
      <div className="paper-reader-layout"><article className="card prelims-question-card paper-text-question" aria-label={`Question ${n} text`}>
          <div className="paper-question-top"><span className="eyebrow">Q{n} · SERIES {paper.booklet} · {question.subject}</span><a className="small" href={paper.paperUrl} target="_blank" rel="noopener noreferrer">Original paper ↗</a></div>
          <QuestionText q={question} />
          <fieldset className="prelims-options"><legend>Choose one answer</legend>{Object.entries(question.options).map(([option, text]) => <label key={option} className={choice === option.toUpperCase() ? "selected" : ""}><input type="radio" name="archive-paper-choice" value={option.toUpperCase()} checked={choice === option.toUpperCase()} disabled={locked} onChange={() => edit({ answers: { ...attempt.answers, [n]: option.toUpperCase() } })} /><strong>{option.toUpperCase()}.</strong><span>{text}</span></label>)}</fieldset>
          {attempt.mode === "practice" && !revealed && <button className="btn primary paper-check-answer" disabled={!choice} onClick={() => edit({ revealed: [...attempt.revealed, n] })}>Submit answer</button>}
          {revealed && <><div className={`paper-answer-feedback ${outcome.toLowerCase()}`} role="status"><strong>{outcome === "Dropped" ? "Dropped by UPSC · excluded from scoring" : `${outcome} · Official answer: ${paperAnswerLabel(key)}`}</strong>{key.length > 1 && key !== "X" && <p>UPSC accepts either answer.</p>}</div>{renderExplanation(question)}</>}
          {!finished && attempt.mode === "test" && <p className="small muted">Answers and explanations appear after you submit the test.</p>}
          <div className="paper-sheet-navigation"><button className="btn secondary" disabled={n === 1} onClick={() => move(n - 1)}>← Previous question</button><button className="btn primary" disabled={n === paper.questionCount} onClick={() => move(n + 1)}>Next question →</button></div>
        </article>
        <aside className="card paper-answer-sheet"><span className="eyebrow">YOUR SESSION</span><div className="paper-question-top"><h3>Question palette</h3><span>{answered}/{paper.questionCount} answered</span></div>
          {!locked && <div className="paper-sheet-tools"><button className="btn secondary" disabled={!choice} onClick={() => { const answers = { ...attempt.answers }; delete answers[String(n)]; edit({ answers }); }}>Clear choice</button><button className="btn secondary" aria-pressed={attempt.review.includes(n)} onClick={() => edit({ review: attempt.review.includes(n) ? attempt.review.filter(q => q !== n) : [...attempt.review, n] })}>{attempt.review.includes(n) ? "Flagged" : "Flag for review"}</button></div>}
          <div className="paper-palette" aria-label="Paper question palette">{paper.answers.map((_, index) => { const question = index + 1, saved = attempt.answers[String(question)], result = finished ? paperOutcome(attempt.keySnapshot[index], saved).toLowerCase() : saved ? "answered" : ""; return <button key={question} className={`${result} ${attempt.review.includes(question) ? "flagged" : ""}`} aria-label={`Question ${question}${saved ? `, answered ${saved}` : ", unanswered"}${attempt.review.includes(question) ? ", flagged" : ""}`} aria-current={question === n ? "step" : undefined} onClick={() => move(question)}>{question}</button>; })}</div>
          <p className="small muted">Filled = answered · dot = flagged. Answers save in this browser.</p>
          {!finished && (finishPrompt ? <div className="paper-finish-prompt" role="group" aria-label="Confirm paper submission"><p>{paper.questionCount - answered} unanswered. Submit this paper and see your report?</p><button className="btn primary" onClick={complete}>Submit paper</button><button className="btn secondary" onClick={() => setFinishPrompt(false)}>Keep working</button></div> : <button className="btn secondary paper-finish" onClick={() => setFinishPrompt(true)}>Finish & view report</button>)}
          {(finished || attempt.mode === "practice") && !!notes.length && <button className="btn secondary paper-finish" onClick={() => setView("study")}>Study all {notes.length} explanations</button>}
        </aside></div>
      {finished && <section className="card paper-key-table"><span className="eyebrow">VERIFIED UPSC KEY · SERIES {paper.booklet}</span><h3>Review every answer</h3><div className="table-wrap"><table><thead><tr><th>Question</th><th>Your answer</th><th>UPSC answer</th><th>Result</th></tr></thead><tbody>{attempt.keySnapshot.map((answer, index) => <tr key={index}><th scope="row">{index + 1}</th><td>{attempt.answers[String(index + 1)] || "—"}</td><td>{paperAnswerLabel(answer)}</td><td>{paperOutcome(answer, attempt.answers[String(index + 1)])}</td></tr>)}</tbody></table></div><p className="small muted">Key published by {paper.keyPublisher}. Checked against the original key on {paper.verifiedOn}. Read each question’s explanation after submission.</p></section>}
    </section>;
  }

  return <section ref={workspace} className="paper-archive" aria-label="2021 to 2024 Civil Services papers">
    <div className="paper-archive-heading"><div><span className="eyebrow">UPSC CIVIL SERVICES · PREVIOUS YEAR PAPERS</span><h2>2021–2024 paper archive</h2><p>Eight complete GS I and CSAT papers in text, with explanations, UPSC final keys and saved progress.</p></div><label>Year<select aria-label="Archive paper year" value={year} onChange={e => setYear(e.target.value)}><option value="">All years</option>{[2024, 2023, 2022, 2021].map(y => <option key={y}>{y}</option>)}</select></label></div>
    {message}
    {[2024, 2023, 2022, 2021].filter(y => !year || String(y) === year).map(y => <section className="paper-year" aria-label={`${y} Civil Services papers`} key={y}><div className="paper-year-label"><h3>{y}</h3><span>Civil Services Preliminary Examination</span></div><div className="prelims-paper-grid">{archivedPapers.filter(p => p.year === y).map(p => {
      const draft = [...runs].reverse().find(r => r.paperId === p.id && !r.completedAt && r.keySha256 === p.keySha256);
      const reports = runs.filter(r => r.paperId === p.id && r.completedAt), latest = reports.at(-1), explanationCount = archivedPaperQuestions(p).length;
      return <article className="card paper-archive-card" key={p.id}><div className="paper-card-top"><span className="paper-type">{p.paper === "gs" ? "GS I" : "CSAT"}</span><span className="paper-verified">✓ UPSC key</span></div><h3>{p.title}</h3><p className="paper-card-meta">{p.questionCount} questions <span>·</span> 200 marks <span>·</span> 2 hours</p><p className="small muted">Series {p.booklet} · one-third penalty · {p.droppedQuestions.length ? `${p.droppedQuestions.length} dropped ${p.droppedQuestions.length === 1 ? "question" : "questions"} excluded` : "all questions scored"}</p>
        <div className="prelims-actions"><button className="btn secondary" onClick={() => open(p, "practice")}>{draft ? `Resume ${draft.mode}` : "Practise paper"}</button>{!draft && <button className="btn primary" onClick={() => open(p, "test")}>Start test</button>}{latest && <button className="btn secondary" onClick={() => open(p, latest.mode, latest.id)}>View report</button>}</div>
        <div className="paper-card-links"><a href={p.paperUrl} target="_blank" rel="noopener noreferrer">Original PDF ↗</a><a href={`${p.keyUrl}#page=${p.keyPage}`} target="_blank" rel="noopener noreferrer">Official key ↗</a>{!!explanationCount && <button onClick={() => study(p)}>{explanationCount} questions & explanations →</button>}</div>
      </article>;
    })}</div></section>)}
    <div className="paper-archive-footer"><p>Question papers and keys: Union Public Service Commission. Linked copies: ForumIAS / IASbaba. Questions and choices are selectable text. Explanations use your supplied study material and editorial solutions; UPSC’s final keys determine scoring. Answer sheets save in this browser, separately for each account; download a backup to keep a copy.</p><button className="btn secondary" disabled={!runs.length} onClick={downloadBackup}>Download paper answers</button></div>
  </section>;
}
