import { useEffect, useRef } from "react";
import { Check, CheckCircle2, ChevronRight, Clock3, Plus, RotateCcw, Target, BookOpen, PenLine, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../hooks/useData";
import { todaySnapshot, studyDuration } from "../utils/workspaceUX";
import { prettyDate } from "../utils/date";
import { recentStudySessions, studyContext } from "../utils/studyForm";
import { ProgressBar, Badge } from "./ui";

export function StudyToday({ today }: { today: string }) {
  const { data, setEditor, markRevision } = useData();
  const revisionList = useRef<HTMLOListElement>(null), revisionLink = useRef<HTMLAnchorElement>(null), reviewed = useRef<string | null>(null);
  const summary = todaySnapshot(data, today), recent = recentStudySessions(data)[0];
  useEffect(() => {
    if (reviewed.current && !summary.due.some(r => r.id === reviewed.current)) {
      reviewed.current = null;
      (revisionList.current?.querySelector<HTMLButtonElement>(".today-review-btn") || revisionLink.current)?.focus();
    }
  }, [data.revisions]);
  const subject = data.subjects.find(s => s.id === recent?.subjectId);
  const openSession = () => setEditor({ collection: "sessions", preset: recent ? { ...studyContext(data, recent), date: today } : { date: today } });
  return <>
    <section className="study-today" aria-labelledby="study-today-title">
      <article className="card today-progress">
        <div className="today-title"><span className="eyebrow"><Clock3 size={14} />TODAY'S STUDY</span><Link to="/settings" className="text-btn">Edit target<ChevronRight size={13} /></Link></div>
        <h2 id="study-today-title">{summary.targetReached ? "Daily target reached" : summary.seconds ? "Keep your day moving." : "Start with one focused session."}</h2>
        <div className="today-time"><strong>{studyDuration(summary.seconds)}</strong><span>of {data.settings.dailyHours}h planned</span></div>
        <ProgressBar value={Math.floor(summary.progress)} label="Daily study target" detail={`${Math.floor(summary.progress)}%`} />
        <p className="today-remaining">{summary.targetReached ? <><CheckCircle2 size={15} />Your target is met. Keep studying or review what you covered.</> : <><Clock3 size={15} />{studyDuration(summary.remainingMinutes * 60)} remaining toward today's target.</>}</p>
        <div className="today-small-metrics"><span><Target size={15} /><strong>{summary.daily.attempted}<small> / {data.settings.mcqTarget}</small></strong><small>questions today</small></span><span><PenLine size={15} /><strong>{summary.daily.answers}<small> / {data.settings.answerTarget}</small></strong><small>answers today</small></span><span><RotateCcw size={15} /><strong>{summary.completedToday}</strong><small>revisions completed</small></span></div>
        <nav className="workspace-shortcuts today-shortcuts" aria-label="Everyday study shortcuts"><button type="button" className="btn primary" onClick={openSession}><Plus size={16} />Log study session</button><Link className="btn secondary" to="/pyqs"><Target size={16} />Practise PYQs</Link><Link className="btn secondary" to="/pyqs?section=papers"><BookOpen size={16} />Full papers</Link></nav>
        <p className="today-time-scope">Recorded study sessions and PYQ practice time.</p>
        {subject && <div className="today-continue"><span>Last studied <strong>{subject.name}</strong> · {recent.activity}</span><button type="button" className="text-btn" onClick={openSession}>Continue subject<ChevronRight size={14} /></button></div>}
      </article>
      <article className="card today-revisions" aria-labelledby="today-revisions-title"><div className="today-revisions-heading"><div><span className="eyebrow"><RotateCcw size={14} />KEEP IT FRESH</span><h2 id="today-revisions-title">Your revision queue</h2></div><Badge tone={summary.due.length ? "amber" : "green"}>{summary.due.length ? `${summary.due.length} due` : "Up to date"}</Badge></div>
        {summary.due.length ? <><p className="today-revision-note">Start with the oldest due topic. Mark it reviewed when you're done.</p><ol className="today-revision-list" ref={revisionList}>{summary.due.slice(0, 3).map(revision => {
          const topic = data.topics.find(t => t.id === revision.topicId)?.name || "Scheduled revision";
          const subjectName = data.subjects.find(s => s.id === revision.subjectId)?.name || "Your subject";
          return <li key={revision.id}><button type="button" className="today-revision-topic" aria-label={`Open revision: ${topic}`} onClick={() => setEditor({ collection: "revisions", record: revision })}><strong>{topic}</strong><span>{subjectName} · {revision.stage}</span><small className={revision.dueDate < today ? "overdue" : ""}>{revision.dueDate < today ? `Overdue · ${prettyDate(revision.dueDate)}` : "Due today"}</small></button><button type="button" className="today-review-btn" aria-label={`Mark reviewed: ${topic}`} title={`Mark ${topic} reviewed today`} onClick={() => { reviewed.current = revision.id; markRevision(revision.id); }}><Check size={15} /><span>Reviewed</span></button></li>;
        })}</ol></> : <div className="today-revision-clear"><span className="today-clear-icon"><CheckCircle2 size={24} /></span><strong>No revisions due today.</strong>{summary.next ? <p>Next: {data.topics.find(t => t.id === summary.next!.topicId)?.name || "Scheduled revision"}<br /><CalendarDays size={12} />{prettyDate(summary.next.dueDate)}</p> : <p>Schedule a topic to build a regular recall routine.</p>}<button type="button" className="btn secondary small-btn" onClick={() => setEditor({ collection: "revisions", preset: { dueDate: today } })}><Plus size={14} />Schedule revision</button></div>}
        <Link className="today-revision-link" ref={revisionLink} to="/revision">Open revision planner{summary.due.length > 3 ? ` · ${summary.due.length - 3} more due` : ""}<ChevronRight size={15} /></Link>
      </article>
    </section>
  </>;
}
