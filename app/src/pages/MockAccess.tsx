import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import "../mock.css";

type AccessState = { userId: string; sessionId: string; path: string; status: "checking" | "locked" | "granted" | "error" };
function authSessionId(token?: string) {
  if (!token) return "";
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")));
    return typeof claims.session_id === "string" ? claims.session_id : "";
  } catch { return ""; }
}

export default function MockAccess({ children }: { children: ReactNode }) {
  const auth = useAuth(), location = useLocation(), navigate = useNavigate();
  const userId = auth.user?.id || "", path = location.pathname;
  const [access, setAccess] = useState<AccessState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [key, setKey] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const request = useRef(0), field = useRef<HTMLInputElement>(null);
  const currentAccess = useRef<AccessState | null>(null);
  const checking = useRef(false), verifying = useRef(false), signOut = useRef(auth.signOut);
  useEffect(() => { signOut.current = auth.signOut; }, [auth.signOut]);
  const flowState = { returnTo: path, mockAccessRequired: true };
  const status = access?.userId === userId && access.sessionId === sessionId && access.path === path ? access.status : "checking";
  useEffect(() => {
    if (!auth.client) return;
    // Session claims only invalidate cached checks; the server decides access.
    // Keep this SDK callback synchronous and perform RPCs in the effect below.
    const { data: { subscription } } = auth.client.auth.onAuthStateChange((_event, session) => {
      setSessionId(authSessionId(session?.access_token));
    });
    return () => subscription.unsubscribe();
  }, [auth.client]);

  const publish = useCallback((next: AccessState) => {
    currentAccess.current = next;
    setAccess(next);
  }, []);
  const check = useCallback(async (refresh = false) => {
    if (!userId || !auth.client || sessionId === null || (refresh && (checking.current || verifying.current))) return;
    const previous = currentAccess.current;
    const preserve = refresh && previous?.userId === userId && previous.sessionId === sessionId && previous.path === path
      && (previous.status === "granted" || previous.status === "locked");
    const current = ++request.current;
    checking.current = true;
    if (!preserve) {
      publish({ userId, sessionId, path, status: "checking" });
      setError(""); setBusy(false); setKey("");
    }
    try {
      const { data, error: rpcError } = await auth.client.rpc("mock_lab", { op: "license-status", p: {} });
      if (current !== request.current) return;
      if (rpcError) {
        if (/Sign in/i.test(rpcError.message)) {
          await signOut.current();
          navigate("/login", { replace: true, state: { returnTo: path, mockAccessRequired: true } });
          return;
        }
        throw new Error("Access could not be checked. Please try again.");
      }
      if (current === request.current) {
        const next = data?.authorized === true ? "granted" : "locked";
        if (!preserve || previous?.status !== next) { setError(""); setKey(""); }
        publish({ userId, sessionId, path, status: next });
      }
    } catch (e) {
      if (current === request.current) {
        // A background connection failure doesn't revoke an already verified
        // session or discard the exam. Every mock API call still checks access.
        if (!preserve) {
          setError((e as Error).message);
          publish({ userId, sessionId, path, status: "error" });
        }
      }
    } finally { if (current === request.current) checking.current = false; }
  }, [auth.client, navigate, userId, sessionId, path, publish]);

  useEffect(() => {
    void check();
    const focus = () => { if (!document.hidden) void check(true); };
    const reconnect = () => { void check(true); };
    window.addEventListener("focus", focus);
    window.addEventListener("online", reconnect);
    return () => {
      request.current++; checking.current = false; verifying.current = false;
      window.removeEventListener("focus", focus); window.removeEventListener("online", reconnect);
    };
  }, [check]);
  useEffect(() => { if (status === "locked" && !busy) field.current?.focus(); }, [status, busy, error]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy || verifying.current || !auth.client || !userId || sessionId === null || status !== "locked") return;
    const current = ++request.current, enteredKey = key;
    checking.current = false; verifying.current = true;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await auth.client.rpc("mock_lab", { op: "verify-license", p: { licenseKey: enteredKey } });
      if (current !== request.current) return;
      setKey("");
      if (rpcError) {
        if (/Sign in/i.test(rpcError.message)) {
          await signOut.current();
          navigate("/login", { replace: true, state: flowState });
          return;
        }
        throw new Error("Verification is unavailable. Please try again.");
      }
      if (data?.authorized === true) publish({ userId, sessionId, path, status: "granted" });
      else { setError(data?.retryAfter ? "Too many attempts. Please try again in a minute." : "Invalid license key. Please enter a valid license key."); field.current?.focus(); }
    } catch (e) {
      if (current === request.current) setError((e as Error).message);
    } finally { if (current === request.current) { verifying.current = false; setBusy(false); } }
  }

  if (!auth.user) return <Navigate to="/login" replace state={flowState} />;
  if (status === "granted") return <>{children}</>;
  return (
    <section className="mock-access" aria-labelledby="mock-access-title">
      <Link className="mock-back-link" to="/tests"><ArrowLeft size={16} />Back to Tests</Link>
      <div className="card mock-access-card">
        <div className="mock-access-icon"><LockKeyhole size={27} aria-hidden="true" /></div>
        <span className="eyebrow">GOLDEN GATE · MOCK TEST ACCESS</span>
        <h1 id="mock-access-title">Verify your license key</h1>
        <p className="muted">One quick check before you begin. Your mock attempts and reports stay in your own account.</p>
        <div className="mock-access-steps" aria-label="Access steps">
          <span><ShieldCheck size={16} />Signed in</span>
          <span aria-current="step"><KeyRound size={16} />License verification</span>
        </div>
        {status === "checking" ? <p className="mock-access-status" role="status">Checking your access…</p>
          : status === "error" ? <div className="mock-access-status"><p className="mock-error" role="alert">{error}</p><button className="btn primary" onClick={() => void check()}>Retry access check</button></div>
          : <form onSubmit={verify}>
            <label htmlFor="mock-license-key">License Key</label>
            <input ref={field} id="mock-license-key" name="licenseKey" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="Enter your license key" value={key} onChange={e => setKey(e.target.value)} maxLength={256} required disabled={busy}
              aria-invalid={!!error} aria-describedby={error ? "mock-license-help mock-license-error" : "mock-license-help"} />
            <p id="mock-license-help" className="small muted">Access is verified securely for this sign-in session.</p>
            {error && <p id="mock-license-error" className="mock-error" role="alert">{error}</p>}
            <button className="btn primary" type="submit" disabled={busy || !key}>{busy ? "Verifying…" : "Verify & continue"}<ArrowRight size={16} /></button>
          </form>}
        <p className="mock-access-footnote"><ShieldCheck size={14} />Private results. Focused practice.</p>
      </div>
    </section>
  );
}

