import { useState } from "react";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase.js";
import { useData } from "../../context/DataContext.jsx";
import { useToast } from "../../components/ui.jsx";
import { parseCSV } from "../../lib/csv.js";
import { slotKey } from "../../lib/schedule.js";

const DAYMAP = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7,
};
const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const parseDay = (v) => {
  const k = norm(v);
  if (DAYMAP[k]) return DAYMAP[k];
  const n = Number(k);
  return n >= 1 && n <= 7 ? n : 0;
};

export default function ImportCsv() {
  const { classes, teachers, settings } = useData();
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  function analyse(text) {
    const rows = parseCSV(text);
    const errors = [];
    const entries = [];
    if (rows.length < 2) return { entries, errors: ["The file has no data rows."] };

    const head = rows[0].map(norm);
    const ci = { cls: head.indexOf("class"), day: head.indexOf("day"), period: head.indexOf("period"), teacher: head.indexOf("teacher"), subject: head.indexOf("subject") };
    if (ci.cls < 0 || ci.day < 0 || ci.period < 0 || ci.teacher < 0)
      return { entries, errors: ["The first row must have the columns: class, day, period, teacher, subject"] };

    const teaching = settings.periods.filter((p) => !p.isBreak);
    const findPeriod = (v) => {
      const k = norm(v);
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1) return teaching[n - 1] || null;
      return teaching.find((p) => norm(p.label) === k) || null;
    };
    const byEmail = new Map(teachers.map((t) => [norm(t.email), t]));
    const byName = new Map();
    for (const t of teachers) byName.set(norm(t.name), [...(byName.get(norm(t.name)) || []), t]);

    const inFile = new Set(rows.slice(1).map((r) => norm(r[ci.cls])).filter(Boolean));
    const occupied = new Map();
    for (const c of classes) {
      if (inFile.has(norm(c.name))) continue;
      for (const [k, v] of Object.entries(c.slots || {})) occupied.set(`${k}|${v.teacherId}`, c.name);
    }
    const seen = new Set();

    rows.slice(1).forEach((r, i) => {
      const line = i + 2;
      const className = (r[ci.cls] || "").trim();
      if (!className) return;
      const day = parseDay(r[ci.day]);
      if (!day) { errors.push(`Row ${line}: day "${r[ci.day] || ""}" is not recognised`); return; }
      const period = findPeriod(r[ci.period] || "");
      if (!period) { errors.push(`Row ${line}: period "${r[ci.period] || ""}" does not match your periods`); return; }
      const tRaw = r[ci.teacher] || "";
      let teacher = byEmail.get(norm(tRaw));
      if (!teacher) {
        const list = byName.get(norm(tRaw)) || [];
        if (list.length > 1) { errors.push(`Row ${line}: more than one teacher is named "${tRaw}". Use their email.`); return; }
        teacher = list[0];
      }
      if (!teacher) { errors.push(`Row ${line}: "${tRaw}" has no account yet`); return; }

      const key = slotKey(day, period.id);
      const dup = `${norm(className)}|${key}`;
      if (seen.has(dup)) { errors.push(`Row ${line}: ${className} already has a lesson at that time`); return; }
      const clash = occupied.get(`${key}|${teacher.id}`);
      if (clash && norm(clash) !== norm(className)) { errors.push(`Row ${line}: ${teacher.name} is already in ${clash} at that time`); return; }
      seen.add(dup);
      occupied.set(`${key}|${teacher.id}`, className);
      entries.push({ className, key, teacherId: teacher.id, subject: (r[ci.subject] || "").trim() });
    });
    return { entries, errors };
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResult(analyse(await f.text()));
    e.target.value = "";
  }

  async function commit() {
    const byClass = new Map();
    for (const en of result.entries) {
      const k = norm(en.className);
      if (!byClass.has(k)) byClass.set(k, { name: en.className, slots: {} });
      byClass.get(k).slots[en.key] = { teacherId: en.teacherId, subject: en.subject };
    }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      for (const [k, c] of byClass) {
        const existing = classes.find((x) => norm(x.name) === k);
        const ref = existing ? doc(db, "classes", existing.id) : doc(collection(db, "classes"));
        batch.set(ref, { name: existing ? existing.name : c.name, slots: c.slots });
      }
      await batch.commit();
      toast(`Imported ${result.entries.length} lessons into ${byClass.size} classes`);
      setResult(null);
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  }

  function template() {
    const first = teachers[0]?.email || "teacher@school.org";
    const csv = `class,day,period,teacher,subject\nGrade 5-A,Mon,1,${first},Maths\nGrade 5-A,Mon,2,${first},Science\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "dailyhour-timetable-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const classCount = result ? new Set(result.entries.map((e) => norm(e.className))).size : 0;

  return (
    <div>
      <p>Bring in the whole weekly timetable from a spreadsheet. Save it as CSV with the columns <strong>class, day, period, teacher, subject</strong>. The teacher can be an email or the exact name. Period can be 1, 2, 3 or the period label.</p>
      <p className="hint">Every class in the file has its weekly timetable replaced. Classes not in the file are left alone. Create teacher accounts first.</p>
      <div className="actions">
        <button className="btn ghost" onClick={template}>Download template</button>
        <label className="btn">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
        </label>
      </div>

      {result && (
        <section className="card">
          <p><strong>{result.entries.length}</strong> lessons ready for <strong>{classCount}</strong> classes.</p>
          {result.errors.length > 0 && (
            <>
              <p className="err">{result.errors.length} {result.errors.length === 1 ? "row was" : "rows were"} skipped:</p>
              <ul className="errlist">
                {result.errors.slice(0, 25).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
              {result.errors.length > 25 && <p className="muted">and {result.errors.length - 25} more.</p>}
            </>
          )}
          <div className="actions">
            <button className="btn" onClick={commit} disabled={busy || !result.entries.length}>Import {result.entries.length} lessons</button>
            <button className="btn ghost" onClick={() => setResult(null)}>Cancel</button>
          </div>
        </section>
      )}
    </div>
  );
}
