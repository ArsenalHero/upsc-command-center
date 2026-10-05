import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import "../mock.css";

type AccessState = { userId: string; path: string; status: "checking" | "locked" | "granted" | "error" };

export default function MockAccess({ children }: { children: ReactNode }) {
  const auth = useAuth(), location = useLocation(), navigate = useNavigate();
  const userId = auth.user?.id || "", path = location.pathname;
  const [access, setAccess] = useState<AccessState | null>(null);
  const [key, setKey] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const request = useRef(0), field = useRef<HTMLInputElement>(null);
  const flowState = { returnTo: path, mockAccessRequired: true };
  const status = access?.userId === userId && access.path === path ? access.status : "checking";

  const check = useCallback(async () => {
    if (!userId || !auth.client) return;
    const current = ++request.current;
    setAccess({ userId, path, status: "checking" });
    setError(""); setBusy(false); setKey("");
    try {
      const { data, error: rpcError } = await auth.client.rpc("mock_lab", { op: "license-status", p: {} });
      if (rpcError) {
        if (/Sign in/i.test(rpcError.message) && current === request.current) {
          await auth.signOut();
          navigate("/login", { replace: true, state: { returnTo: path, mockAccessRequired: true } });
          return;
        }
        throw new Error("Access could not be checked. Please try again.");
      }
      if (current === request.current) setAccess({ userId, path, status: data?.authorized === true ? "granted" : "locked" });
    } catch (e) {
      if (current === request.current) {
        setError((e as Error).message);
        setAccess({ userId, path, status: "error" });
      }
    }
  }, [auth.client, auth.signOut, navigate, userId, path]);

  useEffect(() => {
    void check();
    const focus = () => { if (!document.hidden) void check(); };
    window.addEventListener("focus", focus);
    return () => { request.current++; window.removeEventListener("focus", focus); };
  }, [check]);
  useEffect(() => { if (status === "locked") field.current?.focus(); }, [status]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy || !auth.client || !userId) return;
    const current = ++request.current, enteredKey = key;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await auth.client.rpc("mock_lab", { op: "verify-license", p: { licenseKey: enteredKey } });
      if (current !== request.current) return;
      setKey("");
      if (rpcError) {
        if (/Sign in/i.test(rpcError.message)) {
          await auth.signOut();
          navigate("/login", { replace: true, state: flowState });
          return;
        }
        throw new Error("Verification is unavailable. Please try again.");
      }
      if (data?.authorized === true) setAccess({ userId, path, status: "granted" });
      else { setError(data?.retryAfter ? "Too many attempts. Please try again in a minute." : "Invalid license key. Please enter a valid license key."); field.current?.focus(); }
    } catch (e) {
      if (current === request.current) setError((e as Error).message);
    } finally { if (current === request.current) setBusy(false); }
  }

  if (!auth.user) return <Navigate to="/login" replace state={flowState} />;
  if (status === "granted") return <>{children}</>;
  return (
    <section className="mock-access" aria-labelledby="mock-access-title">
      <Link className="mock-back-link" to="/tests"><ArrowLeft size={16} />Back to Tests</Link>
      <div className="card mock-access-card">
        <div className="mock-access-icon"><LockKeyhole size={27} aria-hidden="true" /></div>
        <span className="eyebrow">MOCK TEST ACCESS</span>
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
            <input ref={field} id="mock-license-key" name="licenseKey" type="password" autoComplete="off" spellCheck={false}
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
