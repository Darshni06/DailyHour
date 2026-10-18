import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useData } from "../../context/DataContext.jsx";
import { Icon, Modal, useToast } from "../../components/ui.jsx";
import { createAccount, friendlyAuthError } from "../../lib/accounts.js";
import { parseCSV } from "../../lib/csv.js";
import { copyText, waLink } from "../../lib/share.js";

const ROLE_ORDER = { admin: 0, coordinator: 1, teacher: 2 };
const ROLE_LABEL = { admin: "Admin", coordinator: "Coordinator", teacher: "Teacher" };

const loginText = (r) =>
  `Hello ${r.name}, your DailyHour account is ready.\nOpen: ${window.location.origin}\nEmail: ${r.email}\nPassword: ${r.password}\nTip: tap "Forgot password" on the sign-in page to choose your own password.`;

export default function People() {
  const { profile, isAdmin } = useAuth();
  const { users, settings } = useData();
  const toast = useToast();
  const [mode, setMode] = useState(null); // "add" | "bulk"
  const [edit, setEdit] = useState(null);
  const [results, setResults] = useState(null);

  const sorted = [...users].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || (a.name || "").localeCompare(b.name || "")
  );
  const canManage = (u) => (isAdmin ? u.id !== profile.id : u.role === "teacher");

  async function setActive(u, active) {
    try {
      await updateDoc(doc(db, "users", u.id), { active });
    } catch (e) {
      toast(friendlyAuthError(e));
    }
  }
  async function reset(u) {
    try {
      await sendPasswordResetEmail(auth, u.email);
      toast(`Reset email sent to ${u.email}`);
    } catch (e) {
      toast(friendlyAuthError(e));
    }
  }

  return (
    <div>
      <div className="actions">
        <button className="btn" onClick={() => setMode("add")}><Icon name="plus" size={18} />Add person</button>
        <button className="btn ghost" onClick={() => setMode("bulk")}>Add many</button>
      </div>

      <ul className="people-list">
        {sorted.map((u) => (
          <li key={u.id} className={u.active === false ? "off" : ""}>
            <div>
              <strong>{u.name}</strong>
              <span className="muted">{ROLE_LABEL[u.role] || u.role}{u.active === false ? ", switched off" : ""}</span>
              <span className="muted">{u.email}{u.phone ? `, ${u.phone}` : ""}</span>
            </div>
            {canManage(u) && (
              <div className="row-actions">
                <button className="btn small ghost" onClick={() => setEdit(u)}>Edit</button>
                <button className="btn small ghost" onClick={() => reset(u)}>Reset password</button>
                <button className="btn small ghost" onClick={() => setActive(u, u.active === false)}>
                  {u.active === false ? "Switch on" : "Switch off"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {mode === "add" && (
        <AddPerson
          isAdmin={isAdmin}
          creator={profile.id}
          cc={settings.countryCode}
          onClose={() => setMode(null)}
        />
      )}
      {mode === "bulk" && (
        <BulkAdd
          isAdmin={isAdmin}
          creator={profile.id}
          cc={settings.countryCode}
          onClose={() => setMode(null)}
          onDone={setResults}
        />
      )}
      {edit && <EditPerson user={edit} onClose={() => setEdit(null)} />}
      {results && <Results rows={results} cc={settings.countryCode} onClose={() => setResults(null)} />}
    </div>
  );
}

function AddPerson({ isAdmin, creator, cc, onClose }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "teacher" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const toast = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await createAccount({ ...f, createdBy: creator });
      setDone({ name: f.name.trim(), phone: f.phone, ...r });
    } catch (ex) {
      setErr(friendlyAuthError(ex));
    }
    setBusy(false);
  }

  if (done)
    return (
      <Modal title="Account created" onClose={onClose}>
        <p>Send these login details to {done.name}. The password is shown only now.</p>
        <pre className="preview">{loginText(done)}</pre>
        <div className="actions">
          <a className="btn" href={waLink(done.phone, loginText(done), cc)} target="_blank" rel="noreferrer"><Icon name="chat" />WhatsApp</a>
          <button className="btn ghost" onClick={async () => { await copyText(loginText(done)); toast("Copied"); }}><Icon name="copy" />Copy</button>
          <button className="btn ghost" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );

  return (
    <Modal title="Add person" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field"><span>Full name</span><input value={f.name} onChange={set("name")} required /></label>
        <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set("email")} required /></label>
        <label className="field"><span>WhatsApp number (optional)</span><input type="tel" value={f.phone} onChange={set("phone")} placeholder="9876543210" /></label>
        {isAdmin && (
          <label className="field">
            <span>Role</span>
            <select value={f.role} onChange={set("role")}>
              <option value="teacher">Teacher</option>
              <option value="coordinator">Coordinator</option>
            </select>
          </label>
        )}
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? "Creating" : "Create account"}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function BulkAdd({ isAdmin, creator, cc, onClose, onDone }) {
  const [text, setText] = useState("");
  const [role, setRole] = useState("teacher");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function run() {
    const rows = parseCSV(text).filter((r) => r[0] && r[1]);
    if (!rows.length) { setProgress("Add one person per line: name, email, phone"); return; }
    setBusy(true);
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const [name, email, phone] = rows[i];
      setProgress(`Creating ${i + 1} of ${rows.length}`);
      try {
        const r = await createAccount({ name, email, phone: phone || "", role, createdBy: creator });
        out.push({ name, phone: phone || "", email: r.email, password: r.password, ok: true });
      } catch (e) {
        out.push({ name, phone: phone || "", email, password: "", ok: false, error: friendlyAuthError(e) });
      }
    }
    setBusy(false);
    onClose();
    onDone(out);
  }

  return (
    <Modal title="Add many people" onClose={onClose}>
      <p className="muted">One person per line: name, email, phone. The phone is optional.</p>
      <label className="field">
        <span>List</span>
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Priya Sharma, priya@school.org, 9876543210\nRahul Verma, rahul@school.org"} />
      </label>
      {isAdmin && (
        <label className="field">
          <span>Role for everyone in this list</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="teacher">Teacher</option>
            <option value="coordinator">Coordinator</option>
          </select>
        </label>
      )}
      {progress && <p className="muted">{progress}</p>}
      <div className="actions">
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Working" : "Create accounts"}</button>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  );
}

function Results({ rows, cc, onClose }) {
  const toast = useToast();
  const good = rows.filter((r) => r.ok);
  const all = good.map((r) => `${r.name}, ${r.email}, ${r.password}`).join("\n");
  return (
    <Modal title="Accounts created" onClose={onClose}>
      <p>{good.length} of {rows.length} created. Passwords are shown only now, so send them before closing.</p>
      <ul className="people-list">
        {rows.map((r, i) => (
          <li key={i}>
            <div>
              <strong>{r.name}</strong>
              <span className="muted">{r.email}</span>
              {r.ok ? <span className="muted">Password: {r.password}</span> : <span className="err">{r.error}</span>}
            </div>
            {r.ok && (
              <a className="btn small" href={waLink(r.phone, loginText(r), cc)} target="_blank" rel="noreferrer"><Icon name="chat" size={16} />Send</a>
            )}
          </li>
        ))}
      </ul>
      <div className="actions">
        {good.length > 0 && (
          <button className="btn ghost" onClick={async () => { await copyText(all); toast("All logins copied"); }}><Icon name="copy" />Copy all logins</button>
        )}
        <button className="btn" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function EditPerson({ user, onClose }) {
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [err, setErr] = useState("");
  async function save(e) {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "users", user.id), { name: name.trim(), phone: phone.trim() });
      onClose();
    } catch (ex) {
      setErr(friendlyAuthError(ex));
    }
  }
  return (
    <Modal title="Edit person" onClose={onClose}>
      <form onSubmit={save}>
        <label className="field"><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>WhatsApp number</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <p className="muted">Email: {user.email}</p>
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button className="btn">Save</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
