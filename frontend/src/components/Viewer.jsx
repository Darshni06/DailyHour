import { useEffect, useMemo, useState } from "react";
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { useData } from "../context/DataContext.jsx";
import { useDayData } from "../lib/hooks.js";
import { classDayRows, slotKey, teacherDayRows, teacherSlotsOnDay } from "../lib/schedule.js";
import { DAY_NAMES, prettyDate, todayStr, weekday } from "../lib/dates.js";
import { dayText, weekText } from "../lib/share.js";
import { DayList, WeekGrid } from "./Views.jsx";
import { DateNav, Empty, Icon, Modal, Segmented } from "./ui.jsx";
import ShareModal from "./ShareModal.jsx";

// Shows one class or one teacher, by day (with absences and cover) or by week.
export default function Viewer({ kind, id, views = ["day", "week"], canEdit = false }) {
  const { classes, settings, nameOf, usersById } = useData();
  const [view, setView] = useState(views[0]);
  const [date, setDate] = useState(todayStr());
  const [edit, setEdit] = useState(false);
  const [cell, setCell] = useState(null);
  const [share, setShare] = useState(false);
  const { subs, absMap } = useDayData(date);

  useEffect(() => { setEdit(false); }, [id]);

  const day = weekday(date);
  const working = settings.days.includes(day);
  const cls = kind === "class" ? classes.find((c) => c.id === id) : null;
  const teacher = kind === "teacher" ? usersById[id] : null;
  const name = kind === "class" ? cls?.name : teacher?.name;

  const rows = useMemo(() => {
    if (!working) return [];
    if (kind === "class") return cls ? classDayRows({ cls, day, settings, absMap, subs, nameOf }) : [];
    return teacherDayRows({ teacherId: id, day, classes, settings, absMap, subs, nameOf });
  }, [working, kind, cls, id, day, classes, settings, absMap, subs, nameOf]);

  const mineByDay = useMemo(() => {
    if (kind !== "teacher") return {};
    const o = {};
    for (const d of settings.days) o[d] = teacherSlotsOnDay(classes, id, d, settings.periods);
    return o;
  }, [kind, id, classes, settings]);

  const cellFn = (d, p) => {
    if (kind === "class") {
      const s = cls?.slots?.[slotKey(d, p.id)];
      if (!s) return null;
      return s.subject ? { title: s.subject, sub: nameOf(s.teacherId) } : { title: nameOf(s.teacherId), sub: "" };
    }
    const s = mineByDay[d]?.[p.id];
    return s ? { title: s.cls.name, sub: s.subject } : null;
  };

  if (!name) return <Empty title="Nothing to show yet">Pick a {kind === "class" ? "class" : "teacher"} above.</Empty>;

  const title = view === "day" ? `${name}, ${prettyDate(date)}` : `${name}, weekly timetable`;
  const text = view === "day" ? dayText(title, rows) : weekText(title, settings, cellFn);

  return (
    <div>
      <div className="toolbar noprint">
        {views.length > 1 && (
          <Segmented value={view} onChange={setView} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} />
        )}
        <div className="grow" />
        {canEdit && view === "week" && (
          <button className={`btn small ${edit ? "" : "ghost"}`} onClick={() => setEdit(!edit)}>
            <Icon name="edit" size={16} />{edit ? "Done editing" : "Edit timetable"}
          </button>
        )}
        <button className="btn small ghost" onClick={() => setShare(true)}>
          <Icon name="share" size={16} />Share
        </button>
      </div>

      <div className="noprint">
        {view === "day" ? (
          <>
            <DateNav date={date} setDate={setDate} />
            {working ? <DayList rows={rows} /> : <Empty title={`No school on ${DAY_NAMES[day]}`}>Pick another date.</Empty>}
          </>
        ) : (
          <>
            {edit && <p className="hint">Tap a slot to choose the teacher and subject.</p>}
            <WeekGrid settings={settings} cell={cellFn} onCell={edit ? (d, p) => setCell({ d, p }) : undefined} />
          </>
        )}
      </div>

      <div className="print-only">
        <h2>{title}</h2>
        <pre>{text}</pre>
      </div>

      {share && (
        <ShareModal
          title="Share timetable"
          text={text}
          phone={teacher?.phone}
          cc={settings.countryCode}
          onClose={() => setShare(false)}
        />
      )}
      {cell && cls && <CellEditor cls={cls} day={cell.d} period={cell.p} onClose={() => setCell(null)} />}
    </div>
  );
}

function CellEditor({ cls, day, period, onClose }) {
  const { classes, teachers, subjectList } = useData();
  const key = slotKey(day, period.id);
  const cur = cls.slots?.[key];
  const [teacherId, setTeacherId] = useState(cur?.teacherId || "");
  const [subject, setSubject] = useState(cur?.subject || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const elsewhere = useMemo(() => {
    const m = {};
    for (const c of classes) {
      const s = c.slots?.[key];
      if (s && c.id !== cls.id) m[s.teacherId] = c.name;
    }
    return m;
  }, [classes, cls.id, key]);

  async function save() {
    if (teacherId && elsewhere[teacherId]) {
      setErr(`That teacher is already in ${elsewhere[teacherId]} at this time.`);
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "classes", cls.id), {
        [`slots.${key}`]: teacherId ? { teacherId, subject: subject.trim() } : deleteField(),
      });
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`${cls.name}, ${DAY_NAMES[day]}, ${period.label}`} onClose={onClose}>
      <label className="field">
        <span>Teacher</span>
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">No class in this slot</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id} disabled={!!elsewhere[t.id]}>
              {t.name}{elsewhere[t.id] ? ` (teaching ${elsewhere[t.id]})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Subject</span>
        <input list="subjects" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Maths" disabled={!teacherId} />
        <datalist id="subjects">{subjectList.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      {err && <p className="err">{err}</p>}
      <div className="actions">
        <button className="btn" onClick={save} disabled={busy}>Save</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
