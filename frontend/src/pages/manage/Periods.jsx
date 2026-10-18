import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase.js";
import { useData } from "../../context/DataContext.jsx";
import { Icon, useToast } from "../../components/ui.jsx";
import { DAY_NAMES } from "../../lib/dates.js";

export default function Periods() {
  const { settings } = useData();
  const toast = useToast();
  const [name, setName] = useState(settings.schoolName || "");
  const [cc, setCc] = useState(settings.countryCode || "91");
  const [days, setDays] = useState(settings.days);
  const [rows, setRows] = useState(settings.periods.map((p) => ({ ...p })));
  const [busy, setBusy] = useState(false);

  const upd = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const n = [...rows];
    [n[i], n[j]] = [n[j], n[i]];
    setRows(n);
  };
  const add = (isBreak) =>
    setRows([
      ...rows,
      {
        id: Math.max(0, ...rows.map((r) => r.id)) + 1,
        label: isBreak ? "Break" : `Period ${rows.filter((r) => !r.isBreak).length + 1}`,
        start: "", end: "", isBreak,
      },
    ]);
  const remove = (i) => {
    if (window.confirm("Remove this row? Lessons placed in it will stop showing.")) setRows(rows.filter((_, j) => j !== i));
  };
  const toggleDay = (d) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);

  async function save() {
    if (!days.length) { toast("Pick at least one working day"); return; }
    if (rows.some((r) => !r.label.trim() || !r.start || !r.end)) { toast("Fill in a label, start and end for every row"); return; }
    setBusy(true);
    try {
      await setDoc(doc(db, "settings", "school"), {
        schoolName: name.trim(),
        countryCode: cc.replace(/\D/g, "") || "91",
        days: [...days].sort(),
        periods: rows.map((r) => ({ id: r.id, label: r.label.trim(), start: r.start, end: r.end, isBreak: !!r.isBreak })),
      });
      toast("Saved");
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  }

  return (
    <div>
      <label className="field"><span>School name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">
        <span>Country code for WhatsApp numbers</span>
        <input value={cc} onChange={(e) => setCc(e.target.value)} inputMode="numeric" />
      </label>

      <div className="field">
        <span>Working days</span>
        <div className="period-pick">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label key={d} className="check"><input type="checkbox" checked={days.includes(d)} onChange={() => toggleDay(d)} />{DAY_NAMES[d]}</label>
          ))}
        </div>
      </div>

      <div className="field"><span>Periods and breaks, in order</span></div>
      <ul className="period-rows">
        {rows.map((r, i) => (
          <li key={r.id} className={r.isBreak ? "brk" : ""}>
            <input aria-label="Label" value={r.label} onChange={(e) => upd(i, { label: e.target.value })} />
            <input aria-label="Start" type="time" value={r.start} onChange={(e) => upd(i, { start: e.target.value })} />
            <input aria-label="End" type="time" value={r.end} onChange={(e) => upd(i, { end: e.target.value })} />
            <label className="check"><input type="checkbox" checked={!!r.isBreak} onChange={(e) => upd(i, { isBreak: e.target.checked })} />Break</label>
            <div className="row-actions">
              <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}><Icon name="left" size={16} /></button>
              <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === rows.length - 1}><Icon name="right" size={16} /></button>
              <button className="icon-btn" onClick={() => remove(i)} aria-label="Remove row"><Icon name="x" size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button className="btn ghost" onClick={() => add(false)}>Add period</button>
        <button className="btn ghost" onClick={() => add(true)}>Add break</button>
      </div>
      <div className="actions">
        <button className="btn" onClick={save} disabled={busy}>Save</button>
      </div>
    </div>
  );
}
