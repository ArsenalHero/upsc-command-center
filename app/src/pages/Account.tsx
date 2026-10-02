import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Cloud,
  Download,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useData } from "../hooks/useData";
import { useWorkspaceSync } from "../hooks/useWorkspaceSync";
import { PageHeader, ConfirmDialog } from "../components/ui";
import { exportJSON } from "../services/export";
import { LocalStorageRepository, STORAGE_KEY } from "../services/repository";
import { authRedirect } from "../services/authConfig";

export default function Account() {
  const auth = useAuth(),
    sync = useWorkspaceSync(),
    { data, replaceData } = useData();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [confirm, setConfirm] = useState<
    "import" | "refresh" | "logout" | null
  >(null);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const hasGuestData = (() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  })();
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title="Your account"
        description="Manage your login and where your preparation records are saved."
      />
      {error && (
        <p className="auth-message error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-message success" role="status">
          {message}
        </p>
      )}
      <div className="account-grid">
        <section className="card account-card">
          <div className="card-heading">
            <h2>
              <UserRound size={18} />
              {auth.user ? "Personal account" : "Guest workspace"}
            </h2>
          </div>
          {auth.user ? (
            <>
              <div className="account-identity">
                <span className="account-avatar">
                  {(
                    String(
                      auth.user.user_metadata.display_name ||
                        auth.user.email ||
                        "U",
                    ).trim()[0] || "U"
                  ).toUpperCase()}
                </span>
                <div>
                  <h3>
                    {auth.user.user_metadata.display_name || "UPSC aspirant"}
                  </h3>
                  <p>{auth.user.email}</p>
                </div>
              </div>
              <p className="account-detail">
                <ShieldCheck size={16} />
                Your study records are private to this account.
              </p>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (!auth.client || !auth.user?.email) return;
                    const { error: resetError } =
                      await auth.client.auth.resetPasswordForEmail(
                        auth.user.email,
                        {
                          redirectTo: authRedirect(
                            "recovery",
                            window.location.href,
                          ),
                        },
                      );
                    if (resetError)
                      throw new Error(
                        "The reset email could not be sent. Please try again later.",
                      );
                    setMessage(
                      "Check your email for a link to change your password.",
                    );
                  })
                }
              >
                <Mail size={16} />
                Email a password reset link
              </button>
            </>
          ) : (
            <>
              <p>
                Your study data is saved in this browser. Log in to keep a
                private account and access your records on other devices when
                accounts are enabled.
              </p>
              <div className="button-group">
                <Link
                  className="btn primary"
                  to="/signup"
                  onClick={auth.leaveGuest}
                >
                  Create account
                </Link>
                <Link
                  className="btn secondary"
                  to="/login"
                  onClick={auth.leaveGuest}
                >
                  Log in
                </Link>
              </div>
            </>
          )}
        </section>
        <section className="card account-card">
          <div className="card-heading">
            <h2>
              <Cloud size={18} />
              {sync.cloud ? "Cloud sync" : "Device storage"}
            </h2>
          </div>
          <p
            className={`account-sync-state ${sync.status.state}`}
            role="status"
          >
            {sync.status.message}
          </p>
          {sync.cloud ? (
            <>
              <p>
                Your syllabus, goals, settings, and study records sync to your
                account. Log in with the same email on another device to
                continue.
              </p>
              {sync.status.updatedAt && (
                <p className="small muted">
                  Last saved: {new Date(sync.status.updatedAt).toLocaleString()}
                </p>
              )}
              <div className="button-group">
                <button
                  className="btn primary"
                  disabled={busy || sync.status.state === "conflict"}
                  onClick={() =>
                    void run(async () => {
                      if (!(await sync.retry()))
                        throw new Error(
                          "Your changes couldn't sync yet. Export a backup and retry when connected.",
                        );
                      setMessage("Your records are up to date.");
                    })
                  }
                >
                  <Cloud size={16} />
                  Sync now
                </button>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    if (sync.status.state !== "synced") setConfirm("refresh");
                    else sync.refresh();
                  }}
                >
                  <RefreshCw size={16} />
                  Load cloud copy
                </button>
              </div>
              <p className="small muted">
                Pending edits are kept on this device until synced. Loading the
                cloud copy replaces pending edits.
              </p>
            </>
          ) : (
            <p>
              Use a JSON backup to move guest records between browsers. Guest
              data is separate from account records.
            </p>
          )}
        </section>
        <section className="card account-card">
          <div className="card-heading">
            <h2>
              <Download size={18} />
              Keep a backup
            </h2>
          </div>
          <p>
            Download all your records, settings, and syllabus as a JSON file.
            You can restore it from Settings.
          </p>
          <button className="btn secondary" onClick={() => exportJSON(data)}>
            <Download size={16} />
            Export my records
          </button>
        </section>
        {auth.user && hasGuestData && (
          <section className="card account-card">
            <div className="card-heading">
              <h2>
                <Upload size={18} />
                Bring your guest records
              </h2>
            </div>
            <p>
              Replace this account's workspace with the guest data saved in this
              browser. Export your current account records first.
            </p>
            <button
              className="btn secondary"
              disabled={busy || sync.status.state === "conflict"}
              onClick={() => setConfirm("import")}
            >
              <Upload size={16} />
              Import guest workspace
            </button>
          </section>
        )}
      </div>
      <section className="card account-signout">
        <div>
          <h2>{auth.user ? "Finished for now?" : "Close guest workspace"}</h2>
          <p>
            {auth.user
              ? "Sign out on this device. Synced records stay in your account, and this account's browser cache is cleared."
              : "Your guest records stay in this browser for your next visit."}
          </p>
        </div>
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              try {
                await sync.signOut();
              } catch (e) {
                if (sync.status.state !== "synced") setConfirm("logout");
                throw e;
              }
            })
          }
        >
          <LogOut size={16} />
          {busy ? "Please wait…" : "Sign out"}
        </button>
      </section>
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "import"
              ? "Replace account records with guest data?"
              : confirm === "refresh"
                ? "Load the cloud copy?"
                : "Sign out with pending changes?"
          }
          text={
            confirm === "import"
              ? "This replaces your account's current workspace and syncs the guest records to your account. Your original guest workspace remains on this device. Export an account backup first if you need it."
              : confirm === "refresh"
                ? "This discards unsynced changes on this device and loads the latest records from your account. Export your pending records first if you need them."
                : "Your unsynced changes will be removed from this device. Export a backup or cancel and retry syncing to keep them."
          }
          label={
            confirm === "import"
              ? "Replace with guest data"
              : confirm === "refresh"
                ? "Load cloud copy"
                : "Discard changes and sign out"
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const action = confirm;
            setConfirm(null);
            if (action === "import") {
              try {
                replaceData(new LocalStorageRepository().load());
              } catch (e) {
                setError((e as Error).message);
              }
            } else if (action === "refresh") sync.refresh(true);
            else void run(() => sync.signOut(true));
          }}
        />
      )}
    </>
  );
}
