import { lazy, Suspense, Component, type ReactNode } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { WorkspaceProvider } from "./hooks/useWorkspaceSync";
import AuthPage, { type AuthMode } from "./pages/Auth";
import Layout from "./components/Layout";
import { GlobalEditor } from "./components/RecordForm";
import { SetupWizard } from "./components/SetupWizard";
import { WebMCP } from "./services/webmcp";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DailyStudy = lazy(() => import("./pages/DailyStudy"));
const Syllabus = lazy(() => import("./pages/Syllabus"));
const Revision = lazy(() => import("./pages/Revision"));
const WeakAreas = lazy(() => import("./pages/WeakAreas"));
const Goals = lazy(() => import("./pages/Goals"));
const Reports = lazy(() => import("./pages/Reports"));
const Resources = lazy(() => import("./pages/Resources"));
const Settings = lazy(() => import("./pages/Settings"));
const Account = lazy(() => import("./pages/Account"));
const practices = [
  "Prelims",
  "Mains",
  "Optional",
  "CSAT",
  "CurrentAffairs",
  "AnswerWriting",
  "Essay",
  "MCQAnalysis",
  "PYQs",
  "Tests",
] as const;
const practiceRoutes = [
  "prelims",
  "mains",
  "optional",
  "csat",
  "current-affairs",
  "answer-writing",
  "essay",
  "mcq-analysis",
  "pyqs",
  "tests",
];
const practiceComponents = practices.map((name) =>
  lazy(() =>
    import("./pages/Practice").then((module) => ({ default: module[name] })),
  ),
);
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="app-error">
        <h1>We couldn't open this view.</h1>
        <p>Reload to try again. Your saved records haven't been replaced.</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload app
        </button>
        <details>
          <summary>Error details</summary>
          {this.state.error}
        </details>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BootRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
function BootRouter() {
  const { loading } = useAuth();
  if (loading)
    return (
      <div className="page-loading" role="status">
        Opening UPSC Command Center…
      </div>
    );
  // Auth callbacks can use the URL fragment. Mount the hash router only after
  // the authentication SDK has consumed confirmation/reset tokens.
  return (
    <HashRouter>
      <WorkspaceRouter />
    </HashRouter>
  );
}
function WorkspaceRouter() {
  const auth = useAuth(),
    location = useLocation();
  const modes: Record<string, AuthMode> = {
    "/login": "login",
    "/signup": "signup",
    "/forgot-password": "forgot",
    "/reset-password": "reset",
  };
  if (auth.recovery && auth.user)
    return <AuthPage key="recovery" mode="reset" />;
  if (modes[location.pathname])
    return (
      <AuthPage
        key={modes[location.pathname]}
        mode={modes[location.pathname]}
      />
    );
  if (!auth.user && !auth.guest) return <Navigate to="/login" replace />;
  return (
    <WorkspaceProvider key={auth.user?.id || "guest"}>
      <Suspense
        fallback={
          <div className="page-loading" role="status">
            Opening your preparation workspace…
          </div>
        }
      >
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="daily-study" element={<DailyStudy />} />
            <Route path="syllabus" element={<Syllabus />} />
            <Route path="revision" element={<Revision />} />
            <Route path="weak-areas" element={<WeakAreas />} />
            <Route path="goals" element={<Goals />} />
            <Route path="reports" element={<Reports />} />
            <Route path="resources" element={<Resources />} />
            <Route path="settings" element={<Settings />} />
            <Route path="account" element={<Account />} />
            {practiceComponents.map((Page, i) => (
              <Route
                key={practiceRoutes[i]}
                path={practiceRoutes[i]}
                element={<Page />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      <GlobalEditor />
      <SetupWizard />
      <WebMCP />
    </WorkspaceProvider>
  );
}
