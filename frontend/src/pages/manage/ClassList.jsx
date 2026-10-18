import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase.js";
import { useData } from "../../context/DataContext.jsx";
import { useToast } from "../../components/ui.jsx";

export default function ClassList() {
  const { classes } = useData();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const have = new Set(classes.map((c) => c.name.toLowerCase()));
    const names = [...new Set(text.split("\n").map((s) => s.trim()).filter(Boolean))].filter((n) => !have.has(n.toLowerCase()));
    if (!names.length) { toast("Nothing new to add"); return; }
    setBusy(true);
    try {
      for (const name of names) await addDoc(collection(db, "classes"), { name, slots: {} });
      setText("");
      toast(`Added ${names.length} ${names.length === 1 ? "class" : "classes"}`);
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  }

  async function rename(c) {
    const name = window.prompt("New name for this class", c.name);
    if (!name || !name.trim() || name.trim() === c.name) return;
    try {
      await updateDoc(doc(db, "classes", c.id), { name: name.trim() });
    } catch (e) {
      toast(e.message);
    }
  }

  async function remove(c) {
    if (!window.confirm(`Delete ${c.name} and its whole timetable? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "classes", c.id));
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <div>
      <label className="field">
        <span>Add classes, one per line</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Grade 1-A\nGrade 1-B\nGrade 2-A"} />
      </label>
      <div className="actions">
        <button className="btn" onClick={add} disabled={busy}>Add classes</button>
      </div>

      <ul className="people-list">
        {classes.map((c) => (
          <li key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <span className="muted">{Object.keys(c.slots || {}).length} lessons a week</span>
            </div>
            <div className="row-actions">
              <button className="btn small ghost" onClick={() => rename(c)}>Rename</button>
              <button className="btn small ghost danger" onClick={() => remove(c)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
