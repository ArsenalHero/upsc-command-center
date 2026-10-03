import { useEffect, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Settings } from "../types";
import { dashboardExams, examCountdown } from "../utils/examSettings";
import { prettyDate } from "../utils/date";

export function ExamCountdowns({ settings }: { settings: Settings }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const exams = dashboardExams(settings);
  return <section className={`exam-countdowns ${exams.length === 1 ? "single" : ""}`} aria-label="Exam countdowns">
    {exams.map(exam => {
      const remaining = examCountdown(exam.date, now);
      return <article key={exam.id} className="card exam-countdown" aria-label={`${exam.name} countdown`}>
        <div className="exam-countdown-heading"><span className="exam-countdown-icon"><CalendarDays size={22} /></span><div><span className="eyebrow">YOUR EXAM COUNTDOWN</span><h2>{exam.name}</h2></div><Link to="/settings" className="text-btn" aria-label={`Edit ${exam.name} exam date`}>Edit date</Link></div>
        {remaining ? <>
          <p className="exam-countdown-date">{prettyDate(exam.date, { day: "numeric", month: "long", year: "numeric" })}<span>00:00 IST</span></p>
          <div className="exam-countdown-digits" role="timer" aria-live="off" aria-label={`Time remaining until ${exam.name}`}>
            {([ [remaining.days, "Days"], [remaining.hours, "Hours"], [remaining.minutes, "Minutes"], [remaining.seconds, "Seconds"] ] as const).map(([value, label]) => <div key={label}><strong>{label === "Days" ? value : String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}
          </div>
          <p className="small muted exam-countdown-note"><Clock3 size={13} />{remaining.reached ? "The exam date has arrived. Update your next target when ready." : "Live countdown to the start of the exam date (IST)."}</p>
        </> : <p className="muted">Choose your exam date in <Link to="/settings">preparation settings</Link> to start the countdown.</p>}
      </article>;
    })}
  </section>;
}
