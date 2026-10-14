import { lazy, Suspense, useState } from "react";
import { Sparkles, ChevronRight, BarChart3, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../hooks/useData";
import { emptyFilters } from "../utils/analytics";
import { prettyDate } from "../utils/date";
import { PageHeader } from "../components/ui";
import { StudyDetails } from "../components/StudyDetails";
import { ExamCountdowns } from "../components/ExamCountdowns";
import { selectedExam, workspaceExamLabel } from "../utils/examSettings";
import { StudyToday } from "../components/StudyToday";
import { useToday } from "../hooks/useToday";
import { useAuth } from "../hooks/useAuth";
const DashboardAnalytics = lazy(() => import("./DashboardAnalytics"));
export default function Dashboard() {
  const { data, loadDemo } = useData();
  const { user } = useAuth();
  const analyticsKey = `upsc:dashboard-analytics:${user?.id || "guest"}`;
  const [analyticsOpen, setAnalyticsOpen] = useState(() => {
    try { return localStorage.getItem(analyticsKey) === "open"; } catch { return false; }
  });
  const toggleAnalytics = () => {
    const open = !analyticsOpen;
    setAnalyticsOpen(open);
    try { localStorage.setItem(analyticsKey, open ? "open" : "closed"); } catch { /* The view still works when browser storage is unavailable. */ }
  };
  const [filters, setFilters] = useState(emptyFilters),
    [radarId, setRadarId] = useState(
      data.subjects.find((s) => s.name.includes("Polity"))?.id ||
        data.subjects[0]?.id ||
        "",
    ),
    [day, setDay] = useState<string | null>(null);
  const today = useToday();
  const hasData = data.sessions.length || data.mcqs.length || data.tests.length || data.pyqs.some((p) => p.attempt);
  return (
    <>
      <PageHeader
        eyebrow="YOUR PREPARATION, AT A GLANCE"
        title={selectedExam(data.settings) === "State PSC" ? "State PSC overview" : "Your preparation"}
        description={`${prettyDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Target ${workspaceExamLabel(data.settings)}`}
      />
      <StudyToday today={today} />
      {!hasData && <div className="dashboard-first-step"><p><Sparkles size={15} /><span><strong>No study data yet.</strong> Your progress appears as you log sessions and practise questions.</span></p><button type="button" className="text-btn" onClick={loadDemo}>Explore with demo data<ChevronRight size={14} /></button></div>}
      <div className="dashboard-countdowns"><ExamCountdowns settings={data.settings} /></div>
      <section className="dashboard-analysis" aria-labelledby="dashboard-analysis-title"><div className="analysis-toolbar"><button type="button" className="analytics-toggle" aria-expanded={analyticsOpen} aria-controls="dashboard-analytics-content" onClick={toggleAnalytics}><span className="analytics-icon"><BarChart3 size={20} /></span><span><strong id="dashboard-analysis-title">Study trends & insights</strong><small>Hours, accuracy, syllabus and study balance</small></span><ChevronDown size={18} className={analyticsOpen ? "expanded" : ""} /></button><Link className="text-btn" to="/reports">Performance reports<ChevronRight size={14} /></Link></div><div id="dashboard-analytics-content" hidden={!analyticsOpen}>{analyticsOpen && <Suspense fallback={<div className="card page-loading" role="status">Opening study trends…</div>}>
        <DashboardAnalytics filters={filters} setFilters={setFilters} radarId={radarId} setRadarId={setRadarId} today={today} onDay={setDay} />
      </Suspense>}
      </div></section>
      {day && <StudyDetails date={day} onClose={() => setDay(null)} />}
    </>
  );
}
