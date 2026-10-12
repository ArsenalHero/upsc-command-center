import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Target,
  FileText,
  PenLine,
  GraduationCap,
  Newspaper,
  BrainCircuit,
  ListChecks,
  RotateCcw,
  AlertTriangle,
  BarChart3,
  Library,
  Settings,
  Search,
  Plus,
  Menu,
  X,
  Sun,
  Moon,
  Database,
  FlaskConical,
  ChevronRight,
  MoreHorizontal,
  CheckCircle2,
  Compass,
  Timer,
  Clock3,
  Layers,
  NotebookPen,
  UserRound,
  Cloud,
  PlayCircle,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { useAuth } from "../hooks/useAuth";
import { useWorkspaceSync } from "../hooks/useWorkspaceSync";
import { Modal, ConfirmDialog, ProgressBar } from "./ui";
import type { Collection, Entity } from "../types";
import { prettyDate, dateKey, daysBetween } from "../utils/date";
import { workspaceExamLabel } from "../utils/examSettings";
import { WorkspaceExamDialog } from "./WorkspaceExamDialog";
import { BrandMark } from "./BrandMark";
export const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, group: "WORKSPACE" },
  {
    label: "Daily Study",
    path: "/daily-study",
    icon: CalendarDays,
    group: "WORKSPACE",
  },
  { label: "Syllabus", path: "/syllabus", icon: BookOpen, group: "WORKSPACE" },
  { label: "Lectures", path: "/lectures", icon: PlayCircle, group: "WORKSPACE" },
  { label: "Books", path: "/books", icon: Library, group: "WORKSPACE" },
  { label: "Revision", path: "/revision", icon: RotateCcw, group: "WORKSPACE" },
  { label: "Goals", path: "/goals", icon: Target, group: "WORKSPACE" },
  {
    label: "Prelims",
    path: "/prelims",
    icon: ListChecks,
    group: "PREPARATION",
  },
  { label: "Mains", path: "/mains", icon: FileText, group: "PREPARATION" },
  {
    label: "Optional",
    path: "/optional",
    icon: GraduationCap,
    group: "PREPARATION",
  },
  { label: "CSAT", path: "/csat", icon: BrainCircuit, group: "PREPARATION" },
  {
    label: "Current Affairs",
    path: "/current-affairs",
    icon: Newspaper,
    group: "PREPARATION",
  },
  {
    label: "Answer Writing",
    path: "/answer-writing",
    icon: PenLine,
    group: "PRACTICE",
  },
  { label: "Essay", path: "/essay", icon: NotebookPen, group: "PRACTICE" },
  {
    label: "MCQ Analysis",
    path: "/mcq-analysis",
    icon: Target,
    group: "PRACTICE",
  },
  { label: "PYQs", path: "/pyqs", icon: Library, group: "PRACTICE" },
  { label: "Tests", path: "/tests", icon: ListChecks, group: "PRACTICE" },
  {
    label: "Weak Areas",
    path: "/weak-areas",
    icon: AlertTriangle,
    group: "REVIEW",
  },
  { label: "Reports", path: "/reports", icon: BarChart3, group: "REVIEW" },
  { label: "Resources", path: "/resources", icon: Layers, group: "REVIEW" },
  { label: "Settings", path: "/settings", icon: Settings, group: "SETTINGS" },
  { label: "Account", path: "/account", icon: UserRound, group: "SETTINGS" },
];
export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { data, setEditor } = useData(), navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null), resultsRef = useRef<HTMLDivElement>(null);
  type Result = { id: string; label: string; type: string; collection?: Collection; record?: Entity; path?: string; keywords?: string };
  const results = useMemo(() => {
    const q = query.trim().toLowerCase(), terms = q.split(/\s+/).filter(Boolean);
    const matches = (value: string) => terms.every(term => value.toLowerCase().includes(term));
    const commands: Result[] = [
      { id: "action:study", label: "Log study session", type: "Quick action", collection: "sessions", keywords: "add record minutes hours study" },
      { id: "page:papers", label: "Full CSE papers · 2015–2025", type: "Page", path: "/pyqs?section=papers", keywords: "previous year question papers pyq gs csat cse upsc prelims past 2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025" },
      { id: "action:mcq", label: "Log MCQ practice", type: "Quick action", collection: "mcqs", keywords: "add questions accuracy multiple choice" },
      { id: "action:answer", label: "Log Mains answer", type: "Quick action", collection: "answers", keywords: "add answer writing mains practice" },
      ...navigation.map(n => ({ id: `page:${n.path}`, label: n.label, type: "Page", path: n.path,
        keywords: n.path === "/pyqs" ? "previous year questions practice question bank" : n.path === "/revision" ? "due overdue review reminders recall" : n.path === "/reports" ? "analytics progress performance" : n.path.replaceAll("-", " ") })),
    ];
    if (q.length < 2) {
      const shortcuts = ["action:study", "page:papers", "page:/pyqs", "page:/revision", "page:/daily-study", "page:/reports"];
      return shortcuts.map(id => commands.find(c => c.id === id)!);
    }
    const found: Result[] = commands.filter(c => matches(`${c.label} ${c.keywords || ""}`));
    data.subjects.filter(s => matches(s.name)).forEach(s => found.push({
      id: `subject:${s.id}`, label: s.name, type: "Subject", path: `/syllabus?subject=${s.id}`,
    }));
    data.topics.filter(t => matches(`${t.name} ${t.notes}`)).forEach(t => found.push({
      id: `topic:${t.id}`, label: t.name, type: "Topic", path: `/syllabus?topic=${t.id}`,
    }));
    const collections = { sessions: "Study session", tests: "Test", pyqs: "PYQ record", resources: "Resource", currentAffairs: "Current affairs", answers: "Mains answer", essays: "Essay", mcqs: "MCQ practice" } as const;
    for (const [collection, type] of Object.entries(collections))
      data[collection as keyof typeof collections].forEach((r: any) => {
        if (matches(JSON.stringify(r))) found.push({ id: `${collection}:${r.id}`, label: r.name || r.title || r.question || r.topic || r.notes || type, type, collection: collection as Collection, record: r });
      });
    return found.slice(0, 35);
  }, [data, query]);
  const open = (result: Result) => {
    onClose();
    if (result.path) navigate(result.path);
    else if (result.collection) setEditor({ collection: result.collection, record: result.record });
  };
  const searching = query.trim().length >= 2;
  return (
    <Modal title="Search & quick navigation" onClose={onClose}>
      <div className="modal-body search-modal">
        <div className="input-icon">
          <Search size={19} />
          <input ref={inputRef} autoFocus aria-label="Universal search" aria-describedby="global-search-help"
            placeholder="Find a page, topic, note or record…" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                const buttons = resultsRef.current?.querySelectorAll<HTMLButtonElement>("button");
                if (buttons?.length) { e.preventDefault(); buttons[e.key === "ArrowDown" ? 0 : buttons.length - 1].focus(); }
              } else if (e.key === "Enter" && searching && results.length) { e.preventDefault(); open(results[0]); }
            }} />
        </div>
        <p className="search-help" id="global-search-help">{searching ? "Pages, subjects and saved records. Use ↑ ↓ to choose and Enter to open." : "Jump to a page or start an entry. Type two or more characters to search."}</p>
        <h3 className="search-section-title">{searching ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Quick shortcuts"}</h3>
        {results.length ? <div className="search-results" ref={resultsRef} onKeyDown={e => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          const buttons = [...(resultsRef.current?.querySelectorAll<HTMLButtonElement>("button") || [])];
          const index = buttons.indexOf(e.target as HTMLButtonElement);
          if (index < 0) return;
          e.preventDefault();
          if (e.key === "ArrowUp" && index === 0) inputRef.current?.focus();
          else buttons[(index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }}>{results.map(r => <button key={r.id} onClick={() => open(r)}>
          <span><strong>{r.label.slice(0, 120)}</strong><small>{r.type}</small></span><ChevronRight size={16} />
        </button>)}</div> : <div className="search-no-results"><Search size={24} /><strong>No matches yet</strong><p>Try a page name such as “Papers”, or a subject, topic or note.</p><button className="text-btn" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>Show shortcuts</button></div>}
      </div>
    </Modal>
  );
}
export default function Layout() {
  const auth = useAuth(),
    sync = useWorkspaceSync();
  const { data, error, toast, setEditor, updateSettings, clearDemo } =
    useData();
  const [drawer, setDrawer] = useState(false),
    [search, setSearch] = useState(false),
    [quick, setQuick] = useState(false),
    [confirm, setConfirm] = useState(false),
    [examDialog, setExamDialog] = useState(false);
  const location = useLocation();
  const current =
    navigation.find((n) => n.path === location.pathname) || navigation[0];
  const demo =
    data.sessions.some((s) => s.demo) || data.mcqs.some((m) => m.demo);
  useEffect(() => {
    setDrawer(false);
    setQuick(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('dialog[open] [aria-label="Universal search"]');
        if (input) { input.focus(); return; }
        // Keep background navigation from replacing an entry in an open form.
        if (document.querySelector("dialog[open]")) return;
        setSearch(true);
      }
      if (e.key === "Escape") {
        setQuick(false);
        setDrawer(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const toggleTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    updateSettings({ ...data.settings, theme: dark ? "light" : "dark" });
  };
  const NavContent = () => (
    <>
      <div className="brand">
        <span className="brand-icon">
          <BrandMark />
        </span>
        <div>
          <strong>UPSC</strong>
          <small>COMMAND CENTER</small>
        </div>
      </div>
      <button type="button" className="workspace-label" aria-label="Choose personal workspace exam" onClick={() => { setDrawer(false); setExamDialog(true); }}>
        <span>Personal workspace</span>
        <strong title={workspaceExamLabel(data.settings)}>{workspaceExamLabel(data.settings)}</strong>
        <ChevronRight size={13} />
      </button>
      <nav aria-label="Main navigation" className="side-nav">
        {["WORKSPACE", "PREPARATION", "PRACTICE", "REVIEW", "SETTINGS"].map(
          (group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-label">{group}</div>
              {navigation
                .filter((n) => n.group === group)
                .map((n) => (
                  <NavLink
                    key={n.path}
                    to={n.path}
                    end={n.path === "/"}
                    className={({ isActive }) =>
                      isActive ? "nav-link active" : "nav-link"
                    }
                    onClick={() => setDrawer(false)}
                  >
                    <n.icon size={18} />
                    <span>{n.label}</span>
                    {n.path === "/revision" &&
                      data.revisions.filter(
                        (r) => !r.completedDate && r.dueDate < dateKey(),
                      ).length > 0 && (
                        <span className="nav-counter">
                          {
                            data.revisions.filter(
                              (r) => !r.completedDate && r.dueDate < dateKey(),
                            ).length
                          }
                        </span>
                      )}
                  </NavLink>
                ))}
            </div>
          ),
        )}
      </nav>
      <NavLink to="/account" className="sidebar-bottom">
        {sync.cloud ? <Cloud size={16} /> : <Database size={16} />}
        <div>
          <strong>
            {sync.cloud ? "Your private account" : "Guest workspace"}
          </strong>
          <small>{sync.status.message}</small>
        </div>
      </NavLink>
    </>
  );
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <NavContent />
      </aside>
      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <aside className="mobile-drawer" aria-label="All pages">
            <button
              className="icon-btn drawer-close"
              aria-label="Close navigation"
              onClick={() => setDrawer(false)}
            >
              <X size={20} />
            </button>
            <NavContent />
          </aside>
        </>
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu-btn"
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={() => setSearch(true)}
              aria-label="Search your preparation"
            >
              <Search size={17} />
              <span>Search or go to…</span>
              <kbd>⌘ K</kbd>
            </button>
            <NavLink
              to="/account"
              className={`storage-status sync-${sync.status.state}`}
              title={sync.status.message}
            >
              <CheckCircle2 size={14} />
              {sync.cloud
                ? sync.status.state === "synced"
                  ? "Cloud saved"
                  : sync.status.state === "saving"
                    ? "Syncing…"
                    : "Sync needs attention"
                : "Guest workspace"}
            </NavLink>
            <button
              className="icon-btn theme-toggle"
              aria-label="Toggle light and dark mode"
              onClick={toggleTheme}
            >
              {data.settings.theme === "dark" ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>
            {auth.user ? (
              <NavLink
                to="/account"
                className="avatar"
                aria-label="Your account"
              >
                {(
                  String(
                    auth.user.user_metadata.display_name ||
                      auth.user.email ||
                      "U",
                  )
                    .trim()
                    .slice(0, 2) || "U"
                ).toUpperCase()}
              </NavLink>
            ) : (
              <NavLink
                to="/login"
                className="account-access"
                onClick={auth.leaveGuest}
              >
                <UserRound size={16} />
                Log in
              </NavLink>
            )}
          </div>
        </header>
        {sync.cloud &&
          (sync.status.state === "error" ||
            sync.status.state === "conflict") && (
            <div className="attention-banner sync-banner" role="alert">
              <Cloud size={20} />
              <p>{sync.status.message}</p>
              <NavLink className="btn secondary" to="/account">
                Manage sync
              </NavLink>
            </div>
          )}
        {demo && (
          <div className="demo-banner">
            <FlaskConical size={15} />
            <span>
              <strong>Demo mode</strong> · You're exploring fictional
              preparation data.
            </span>
            <button onClick={() => setConfirm(true)}>Clear demo data</button>
          </div>
        )}
        {error && (
          <div className="attention-banner storage-error" role="alert">
            <AlertTriangle size={21} />
            <p>{error}</p>
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>UPSC Command Center</span>
          <span>
            Your data. Your preparation. <Database size={12} />{" "}
            {sync.cloud
              ? "Private account workspace."
              : "Saved on this device."}
          </span>
        </footer>
      </div>
      <div className="quick-add-wrap">
        {quick && (
          <div className="quick-menu" role="menu" aria-label="Quick add">
            {(
              [
                {
                  collection: "sessions",
                  label: "Study Session",
                  icon: Clock3,
                },
                { collection: "mcqs", label: "MCQ Practice", icon: Target },
                { collection: "answers", label: "Mains Answer", icon: PenLine },
                { collection: "revisions", label: "Revision", icon: RotateCcw },
                { collection: "tests", label: "Test", icon: ListChecks },
                { collection: "essays", label: "Essay", icon: NotebookPen },
                {
                  collection: "currentAffairs",
                  label: "Current Affairs",
                  icon: Newspaper,
                },
              ] as const
            ).map((i) => (
              <button
                role="menuitem"
                key={i.collection}
                onClick={() => {
                  setQuick(false);
                  setEditor({ collection: i.collection });
                }}
              >
                <i.icon size={17} />
                {i.label}
              </button>
            ))}
          </div>
        )}
        <button
          className={`quick-add ${quick ? "open" : ""}`}
          aria-label={quick ? "Close quick add" : "Quick add"}
          aria-expanded={quick}
          onClick={() => setQuick(!quick)}
        >
          {quick ? <X size={24} /> : <Plus size={25} />}
        </button>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[
          { path: "/", label: "Home", icon: LayoutDashboard },
          { path: "/daily-study", label: "Study", icon: CalendarDays },
          { path: "/syllabus", label: "Syllabus", icon: BookOpen },
          { path: "/reports", label: "Analytics", icon: BarChart3 },
        ].map((n) => (
          <NavLink key={n.path} to={n.path} end={n.path === "/"}>
            <n.icon size={20} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button onClick={() => setDrawer(!drawer)} aria-label="More pages">
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
      {search && <GlobalSearch onClose={() => setSearch(false)} />}
      {examDialog && <WorkspaceExamDialog onClose={() => setExamDialog(false)} />}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast">
            <CheckCircle2 size={18} />
            {toast}
          </div>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title="Clear fictional demo data?"
          text="Demo records will be removed and the seeded syllabus progress reset. New personal records and custom topics remain."
          label="Clear demo data"
          onClose={() => setConfirm(false)}
          onConfirm={clearDemo}
        />
      )}
    </div>
  );
}
