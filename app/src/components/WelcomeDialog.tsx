import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Quote, Sparkles } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useData } from "../hooks/useData";
import { guestGreeting, normalizeGuestName } from "../services/guestProfile";
import { Modal } from "./ui";
import "../welcome.css";

export function WelcomeDialog() {
  const auth = useAuth(), navigate = useNavigate();
  const { data, updateSettings } = useData();
  const [name, setName] = useState(auth.guestName), [editing, setEditing] = useState(false);
  const [error, setError] = useState(""), [storageNote, setStorageNote] = useState("");
  const input = useRef<HTMLInputElement>(null), continueButton = useRef<HTMLButtonElement>(null);
  const displayName = auth.user ? normalizeGuestName(String(auth.user.user_metadata.display_name || auth.user.user_metadata.full_name || auth.user.email?.split("@")[0] || "UPSC aspirant")) : auth.guestName;
  const inputId = useId(), helpId = useId(), needsName = !auth.user && (!auth.guestName || editing);

  useEffect(() => {
    if (!auth.welcomeOpen) return;
    if (needsName) input.current?.focus();
    else continueButton.current?.focus();
  }, [auth.welcomeOpen, needsName, auth.user?.id, data.settings.setupCompleted]);

  if (!auth.welcomeOpen || (auth.user && !data.settings.setupCompleted)) return null;
  function finish() {
    if (!auth.user && !data.settings.setupCompleted) updateSettings({ ...data.settings, setupCompleted: true });
    auth.dismissWelcome();
  }
  function close() {
    if (editing && auth.guestName) { setEditing(false); setError(""); }
    else if (displayName) finish();
    else { auth.leaveGuest(); navigate("/login", { replace: true }); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const clean = normalizeGuestName(name);
    if (!clean) { setError("Enter your name to continue."); input.current?.focus(); return; }
    const stored = auth.saveGuestName(clean);
    setName(clean); setEditing(false); setError("");
    setStorageNote(stored ? "" : "Your browser could not remember your name. You may be asked again next time.");
  }

  return <Modal className="welcome-dialog" title={needsName ? "What should we call you?" : `${guestGreeting()}, ${displayName}!`} onClose={close} closeLabel={needsName ? "Cancel name entry" : "Close welcome"}>
    {needsName ? <form onSubmit={save}>
      <div className="modal-body welcome-dialog-body">
        <span className="welcome-dialog-emblem" aria-hidden="true"><Sparkles size={25}/></span>
        <p>Just your name, and you’re ready to begin.</p>
        <label htmlFor={inputId}>Your name</label>
        <input ref={input} id={inputId} name="guestName" autoComplete="given-name" maxLength={60} required value={name} placeholder="Enter your name" onChange={e => { setName(e.target.value); setError(""); }} aria-describedby={helpId} aria-invalid={!!error}/>
        <p id={helpId} className="welcome-dialog-note">Saved in this browser. No email or password needed.</p>
        {error && <p className="welcome-dialog-error" role="alert">{error}</p>}
      </div>
      <div className="modal-foot"><button type="button" className="btn secondary" onClick={close}>Cancel</button><button type="submit" className="btn primary">Continue<ArrowRight size={16}/></button></div>
    </form> : <>
      <div className="modal-body welcome-dialog-body">
        <span className="welcome-dialog-emblem" aria-hidden="true"><Sparkles size={25}/></span>
        <p>A fresh moment to learn, practise and move forward.</p>
        <blockquote className="welcome-dialog-quote"><Quote size={23} aria-hidden="true"/><p>{auth.welcomeQuote}</p><footer>ONE STEP AT A TIME</footer></blockquote>
        {storageNote && <p className="welcome-dialog-note" role="status">{storageNote}</p>}
      </div>
      <div className="modal-foot">{!auth.user && <button type="button" className="text-btn" onClick={() => { setName(auth.guestName); setEditing(true); }}>Change name</button>}<button ref={continueButton} type="button" className="btn primary" onClick={finish}>Let’s study<ArrowRight size={16}/></button></div>
    </>}
  </Modal>;
}
