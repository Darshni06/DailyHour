import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Logo } from "../components/ui.jsx";
import { friendlyAuthError } from "../lib/accounts.js";

export default function Login() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && profile) navigate("/", { replace: true });
  }, [user, profile, navigate]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setMsg({ type: "err", text: friendlyAuthError(err) });
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setMsg({ type: "err", text: "Type your email first, then tap Forgot password." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg({ type: "ok", text: "Check your inbox for a link to set a new password. Look in spam too." });
    } catch (err) {
      setMsg({ type: "err", text: friendlyAuthError(err) });
    }
  }

  return (
    <div className="login">
      <div className="login-brand">
        <Logo size={44} />
        <h1>Cover arranged before the first bell.</h1>
        <p>Timetables, absences and substitutions for your school, in one place.</p>
      </div>
      <form className="card login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        <p className="muted">Use the email your school admin registered for you.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {msg.text && <p className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</p>}
        <button className="btn block" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
        <button type="button" className="linklike" onClick={forgot}>Forgot password</button>
      </form>
    </div>
  );
}
