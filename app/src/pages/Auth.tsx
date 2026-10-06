import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  RotateCcw,
  Target,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { authRedirect } from "../services/authConfig";
import { authErrorMessage } from "../services/authErrors";

export type AuthMode = "login" | "signup" | "forgot" | "reset";
const headings = {
  login: "Welcome back.",
  signup: "Start your journey.",
  forgot: "Forgot your password?",
  reset: "Choose a new password.",
};
const descriptions = {
  login: "Log in to continue your preparation.",
  signup: "Create your own preparation workspace.",
  forgot: "We'll email you a link to reset it.",
  reset: "Use a password you haven't used before.",
};
export default function AuthPage({ mode }: { mode: AuthMode }) {
  const auth = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const requested = location.state?.returnTo;
  const returnTo = typeof requested === "string" && /^\/tests\/[a-zA-Z0-9/-]+$/.test(requested) ? requested : "/";
  const mockAccessRequired = !!location.state?.mockAccessRequired;
  const authFlowState = mockAccessRequired ? { returnTo, mockAccessRequired: true } : location.state;
  const [name, setName] = useState(""),
    [email, setEmail] = useState("");
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [mode],
  );
  useEffect(() => {
    if (auth.user && !auth.recovery && (mode === "login" || mode === "signup"))
      navigate(returnTo, { replace: true });
  }, [auth.user, auth.recovery, mode, navigate, returnTo]);
  const needsPassword = mode !== "forgot",
    newPassword = mode === "signup" || mode === "reset";
  const validReset = !!auth.user && auth.recovery;
  const unavailable = !auth.client || (mode === "reset" && !validReset);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth.client || busy || unavailable) return;
    const current = ++request.current;
    setError("");
    setSuccess("");
    if (newPassword && password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: loginError } = await auth.client.auth.signInWithPassword(
          { email: email.trim(), password },
        );
        if (loginError) throw loginError;
      } else if (mode === "signup") {
        const { error: signupError, data } = await auth.client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: authRedirect("email", window.location.href),
          },
        });
        if (signupError) throw signupError;
        if (!data.session && current === request.current)
          setSuccess(
            "Check your email for a confirmation link. Confirm your address, then log in to open your workspace.",
          );
      } else if (mode === "forgot") {
        const { error: resetError } =
          await auth.client.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: authRedirect("recovery", window.location.href),
          });
        if (resetError) throw resetError;
        if (current === request.current)
          setSuccess(
            "If this email has an account, a password reset link will arrive shortly. Check your spam folder too.",
          );
      } else {
        const { error: updateError } = await auth.client.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;
        auth.finishRecovery();
        navigate("/", { replace: true });
      }
      if (current === request.current) { setPassword(""); setConfirm(""); }
    } catch (e) {
      if (current === request.current) setError(authErrorMessage(e, mode));
    } finally {
      if (current === request.current) setBusy(false);
    }
  }
  async function resend() {
    if (!auth.client || busy) return;
    const current = ++request.current;
    setBusy(true);
    setError("");
    try {
      const { error: resendError } = await auth.client.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: authRedirect("email", window.location.href),
        },
      });
      if (resendError) throw resendError;
      if (current === request.current) setSuccess("A confirmation email has been requested. Check your inbox and spam folder.");
    } catch (e) {
      if (current === request.current) setError(authErrorMessage(e, "resend"));
    } finally {
      if (current === request.current) setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Golden Gate">
        <Link to="/login" state={authFlowState} className="auth-brand">
          <span className="auth-brand-icon">
            <BarChart3 size={25} />
          </span>
          <span>
            <strong>Golden Gate</strong>
            <small>UPSC PREPARATION</small>
          </span>
        </Link>
        <div className="auth-story-content">
          <span className="auth-eyebrow">MAKE EVERY STUDY SESSION COUNT</span>
          <h2>
            Your preparation.
            <br />
            Your pace.
          </h2>
          <p>
            Build a study routine that works for you. See your progress, find
            your next focus, and keep moving forward.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="auth-illustration-label">
              <span>
                <BarChart3 size={17} />
                Your progress
              </span>
              <span className="auth-mini-badge">ONE DAY AT A TIME</span>
            </div>
            <div className="auth-bars">
              {[32, 50, 43, 69, 60, 80, 91].map((height, i) => (
                <div key={i} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="auth-illustration-footer">
              <span>Plan</span>
              <span>Practise</span>
              <span>
                Progress <ArrowRight size={14} />
              </span>
            </div>
          </div>
          <ul className="auth-features">
            <li>
              <BookOpen size={18} />
              <span>Log study sessions and syllabus progress</span>
            </li>
            <li>
              <Target size={18} />
              <span>Set goals that fit your schedule</span>
            </li>
            <li>
              <RotateCcw size={18} />
              <span>Stay on top of practice and revision</span>
            </li>
          </ul>
        </div>
        <p className="auth-story-footer">
          A clearer view of your journey to CSE.
        </p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          {(mode === "login" || mode === "signup") && (
            <div className="auth-tabs" aria-label="Account access">
              <Link className={mode === "login" ? "active" : ""} to="/login" state={authFlowState}>
                Log in
              </Link>
              <Link className={mode === "signup" ? "active" : ""} to="/signup" state={authFlowState}>
                Sign up
              </Link>
            </div>
          )}
          <span className="auth-form-icon">
            {mode === "forgot" ? <Mail size={25} /> : <LockKeyhole size={25} />}
          </span>
          <h1>{headings[mode]}</h1>
          <p className="auth-description">{descriptions[mode]}</p>
          {mockAccessRequired && (
            <div className="auth-notice" role="status">
              <strong>Sign-in is required to access Mock Tests.</strong>
              <span>After signing in, verify your license key to continue.</span>
            </div>
          )}
          {mode === "reset" && validReset && (
            <p className="auth-description">
              Updating the password for {auth.user?.email}.
            </p>
          )}
          {!auth.client && (
            <div className="auth-notice" role="status">
              <strong>Accounts are being set up.</strong>
              <span>
                You can use the tracker as a guest now. Guest records stay in
                this browser.
              </span>
            </div>
          )}
          {auth.error && (
            <p className="auth-message error" role="alert">
              {auth.error}
            </p>
          )}
          {mode === "reset" && !validReset && (
            <p className="auth-message error" role="alert">
              Open the password reset link from your email to choose a new
              password. <Link to="/forgot-password" state={authFlowState}>Request a new link</Link>.
            </p>
          )}
          {error && (
            <p className="auth-message error" role="alert">
              {error}
            </p>
          )}
          {success ? (
            <div className="auth-success" role="status">
              <CheckCircle2 size={32} />
              <h2>Check your inbox</h2>
              <p>{success}</p>
              {mode === "signup" && (
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={resend}
                >
                  {busy ? "Sending…" : "Resend confirmation"}
                </button>
              )}
              <Link className="btn primary" to="/login" state={authFlowState}>
                Back to log in <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <fieldset disabled={busy || unavailable} className="auth-fields">
                {mode === "signup" && (
                  <label htmlFor="auth-name">
                    Your name
                    <input
                      id="auth-name"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      required
                      placeholder="Your name"
                    />
                  </label>
                )}
                {mode !== "reset" && (
                  <label htmlFor="auth-email">
                    Email address
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={254}
                      placeholder="you@example.com"
                    />
                  </label>
                )}
                {needsPassword && (
                  <label htmlFor="auth-password">
                    {mode === "reset" ? "New password" : "Password"}
                    <span className="auth-password-input">
                      <input
                        id="auth-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          newPassword ? "new-password" : "current-password"
                        }
                        minLength={newPassword ? 8 : undefined}
                        maxLength={128}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder={
                          newPassword
                            ? "At least 8 characters"
                            : "Enter your password"
                        }
                        aria-describedby={
                          newPassword ? "password-help" : undefined
                        }
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </span>
                  </label>
                )}
                {newPassword && (
                  <>
                    <p id="password-help" className="auth-field-help">
                      Use at least 8 characters. A longer, unique password is
                      better.
                    </p>
                    <label htmlFor="auth-confirm">
                      Confirm password
                      <input
                        id="auth-confirm"
                        name="confirm-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        placeholder="Enter your password again"
                      />
                    </label>
                  </>
                )}
                <button className="btn primary auth-submit" type="submit">
                  {busy
                    ? "Please wait…"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "login"
                        ? "Log in"
                        : mode === "forgot"
                          ? "Send reset link"
                          : "Save new password"}
                  <ArrowRight size={17} />
                </button>
              </fieldset>
            </form>
          )}
          {mode === "login" && (
            <div className="auth-links">
              <Link to="/forgot-password" state={authFlowState}>Forgot password?</Link>
              <span>
                New here? <Link to="/signup" state={authFlowState}>Create an account</Link>
              </span>
            </div>
          )}
          {mode === "signup" && !success && (
            <p className="auth-terms">
              Your study records belong to your account. You can export a backup
              whenever you need.
            </p>
          )}
          {(mode === "forgot" || mode === "reset") && !success && (
            <Link
              className="auth-back"
              to="/login" state={authFlowState}
              onClick={() => {
                if (auth.user) auth.finishRecovery();
              }}
            >
              Back to log in
            </Link>
          )}
          {mode !== "reset" && !auth.user && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <button
                className="btn secondary auth-guest"
                onClick={() => {
                  auth.enterGuest();
                  navigate("/", { replace: true });
                }}
              >
                Continue as guest
              </button>
              <p className="auth-guest-note">
                Guest mode saves on this device.
                <br />
                {auth.client
                  ? "Log in to sync your workspace across devices."
                  : "Account sync will be available when setup is complete."}
              </p>
            </>
          )}
        </div>
        <p className="auth-form-footer">
          Golden Gate · Your data. Your preparation.
        </p>
      </section>
    </main>
  );
}

