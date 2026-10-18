import { useEffect, useMemo, useState } from "react";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useDayData, useMonthSubs } from "../lib/hooks.js";
import { absenceDocId, randomToken, rankCandidates, slotKey, subDocId, teacherSlotsOnDay } from "../lib/schedule.js";
import { fmtTime, prettyDate, todayStr, weekday } from "../lib/dates.js";
import { sheetText, waLink } from "../lib/share.js";
import { DateNav, Empty, Icon, Modal, useToast } from "../components/ui.jsx";
import ShareModal from "../components/ShareModal.jsx";

export default function Substitutions() {
  const { profile } = useAuth();
  const { classes, settings, teachers, usersById, nameOf, subjectsBy } = useData();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const { abs, subs, absMap, loaded } = useDayData(date);
  const monthSubs = useMonthSubs(date);
  const [absentOpen, setAbsentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [meta, setMeta] = useState({ date: null, token: null });

  const day = weekday(date);
  const working = settings.days.includes(day);

  // The secret link token for this date, if the day was ever published.
  useEffect(
    () =>
      onSnapshot(
        doc(db, "sheetMeta", date),
        (s) => setMeta({ date, token: s.exists() ? s.data().token : null }),
        () => setMeta({ date, token: null })
      ),
    [date]
  );
  const token = meta.date === date ? meta.token : null;

  const monthCounts = useMemo(() => {
    const m = {};
    for (const s of monthSubs) if (s.date !== date) m[s.substituteId] = (m[s.substituteId] || 0) + 1;
    return m;
  }, [monthSubs, date]);

  // Every lesson that lost its teacher today.
  const affected = useMemo(() => {
    const list = [];
    for (const a of abs) {
      settings.periods.forEach((p, pi) => {
        if (p.isBreak) return;
        if (!(a.allDay || (a.periods || []).includes(p.id))) return;
        for (const c of classes) {
          const s = c.slots?.[slotKey(day, p.id)];
          if (s && s.teacherId === a.teacherId) list.push({ cls: c, period: p, pi, teacherId: a.teacherId, subject: s.subject || "" });
        }
      });
    }
    return list.sort((x, y) => x.pi - y.pi || x.cls.name.localeCompare(y.cls.name, undefined, { numeric: true }));
  }, [abs, classes, settings, day]);

  const subFor = (it) => subs.find((s) => s.classId === it.cls.id && s.periodId === it.period.id);

  const candidatesFor = (it, pool) =>
    rankCandidates({
      cls: it.cls, subject: it.subject, periodId: it.period.id, day, classes, absMap,
      subs: pool.filter((s) => !(s.classId === it.cls.id && s.periodId === it.period.id)),
      teachers, monthCounts, subjectsBy,
    });

  async function assign(it, substituteId) {
    const ref = doc(db, "substitutions", subDocId(date, it.cls.id, it.period.id));
    try {
      if (!substituteId) await deleteDoc(ref);
      else
        await setDoc(ref, {
          date, day, classId: it.cls.id, periodId: it.period.id, absentTeacherId: it.teacherId,
          substituteId, subject: it.subject, updatedBy: profile.id, updatedAt: serverTimestamp(),
        });
    } catch (e) {
      toast(e.message);
    }
  }

  async function autoAssign() {
    const pending = affected.filter((it) => !subFor(it));
    if (!pending.length) { toast("Every period already has cover"); return; }
    const pool = [...subs];
    const batch = writeBatch(db);
    let done = 0;
    for (const it of pending) {
      const best = candidatesFor(it, pool)[0];
      if (!best) continue;
      const rec = {
        date, day, classId: it.cls.id, periodId: it.period.id, absentTeacherId: it.teacherId,
        substituteId: best.teacher.id, subject: it.subject,
      };
      pool.push(rec);
      batch.set(doc(db, "substitutions", subDocId(date, it.cls.id, it.period.id)), { ...rec, updatedBy: profile.id, updatedAt: serverTimestamp() });
      done++;
    }
    if (!done) { toast("No free teachers found"); return; }
    try {
      await batch.commit();
      toast(`Assigned ${done} of ${pending.length}`);
    } catch (e) {
      toast(e.message);
    }
  }

  async function removeAbsence(a) {
    if (!window.confirm(`Remove the absence for ${nameOf(a.teacherId)}? Their cover for this day will be cleared.`)) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, "absences", a.id));
    subs.filter((s) => s.absentTeacherId === a.teacherId).forEach((s) => batch.delete(doc(db, "substitutions", s.id)));
    try {
      await batch.commit();
    } catch (e) {
      toast(e.message);
    }
  }

  // ----- the shareable sheet -----
  const sheetItems = useMemo(
    () =>
      affected.map((it) => {
        const sub = subs.find((s) => s.classId === it.cls.id && s.periodId === it.period.id);
        return {
          period: it.period.label,
          time: `${fmtTime(it.period.start)} to ${fmtTime(it.period.end)}`,
          className: it.cls.name,
          subject: it.subject,
          absent: nameOf(it.teacherId),
          substitute: sub ? nameOf(sub.substituteId) : "",
          substituteId: sub ? sub.substituteId : "",
        };
      }),
    [affected, subs, nameOf]
  );
  const absentList = useMemo(() => abs.map((a) => ({ name: nameOf(a.teacherId), allDay: !!a.allDay })), [abs, nameOf]);

  const publicItems = sheetItems.map(({ substituteId, ...rest }) => rest);

  async function writeSheet(tok) {
    const id = `${date}_${tok}`;
    await setDoc(doc(db, "publishedSheets", id), {
      date, schoolName: settings.schoolName || "", items: publicItems, absent: absentList, updatedAt: serverTimestamp(),
    });
    return `${window.location.origin}/s/${id}`;
  }

  async function publish() {
    let tok = token;
    if (!tok) {
      tok = randomToken();
      await setDoc(doc(db, "sheetMeta", date), { token: tok, date });
    }
    return writeSheet(tok);
  }

  // Once a day has been shared, keep the public copy in step with every change.
  const sheetKey = JSON.stringify([publicItems, absentList]);
  useEffect(() => {
    if (!loaded || !token) return undefined;
    const t = setTimeout(() => { writeSheet(token).catch(() => {}); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, token, sheetKey, date]);

  const covered = affected.filter((it) => subFor(it)).length;

  return (
    <div>
      <div className="noprint">
        <h1>Substitutions</h1>
        <DateNav date={date} setDate={setDate} />

        {!working ? (
          <Empty title="No school on this day">Pick another date, or change working days in Manage, Periods.</Empty>
        ) : (
          <>
            <section className="card summary">
              <p>
                {abs.length === 0
                  ? "Nobody is marked absent."
                  : `${abs.length} absent. ${affected.length} ${affected.length === 1 ? "period needs" : "periods need"} cover, ${covered} covered.`}
              </p>
              <div className="actions">
                <button className="btn" onClick={() => setAbsentOpen(true)}><Icon name="plus" size={18} />Mark absent</button>
                {affected.length > covered && (
                  <button className="btn peach" onClick={autoAssign}><Icon name="wand" size={18} />Auto-assign</button>
                )}
                {affected.length > 0 && (
                  <button className="btn ghost" onClick={() => setShareOpen(true)}><Icon name="share" size={18} />Share</button>
                )}
              </div>
              {abs.length > 0 && (
                <div className="chips">
                  {abs.map((a) => (
                    <span className="chip" key={a.id}>
                      {nameOf(a.teacherId)}{a.allDay ? "" : " (part day)"}
                      <button onClick={() => removeAbsence(a)} aria-label={`Remove absence for ${nameOf(a.teacherId)}`}><Icon name="x" size={14} /></button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {abs.length > 0 && affected.length === 0 && (
              <Empty title="No lessons to cover">The absent teachers have no classes on this day.</Empty>
            )}

            <div className="covers">
              {affected.map((it) => {
                const sub = subFor(it);
                const cands = candidatesFor(it, subs);
                const options =
                  sub && !cands.some((c) => c.teacher.id === sub.substituteId)
                    ? [{ teacher: { id: sub.substituteId, name: nameOf(sub.substituteId) }, why: [] }, ...cands]
                    : cands;
                return (
                  <article key={`${it.cls.id}_${it.period.id}`} className={`cover ${sub ? "done" : "todo"}`}>
                    <div className="cover-top">
                      <div>
                        <strong>{it.cls.name}</strong>
                        <span>{it.period.label}, {fmtTime(it.period.start)}</span>
                      </div>
                      <span className={`tag ${sub ? "normal" : "absent"}`}>{sub ? "Covered" : "Needs cover"}</span>
                    </div>
                    <p className="muted">{it.subject ? `${it.subject}. ` : ""}{nameOf(it.teacherId)} is absent.</p>
                    <select
                      aria-label={`Cover for ${it.cls.name}, ${it.period.label}`}
                      value={sub?.substituteId || ""}
                      onChange={(e) => assign(it, e.target.value)}
                    >
                      <option value="">{options.length ? "Choose a teacher" : "No free teacher"}</option>
                      {options.map((c) => (
                        <option key={c.teacher.id} value={c.teacher.id}>
                          {c.teacher.name}{c.why.length ? ` (${c.why.join(", ")})` : ""}
                        </option>
                      ))}
                    </select>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="print-only">
        <h2>{`Cover arrangements for ${prettyDate(date)}`}</h2>
        <pre>{sheetText(date, sheetItems, "")}</pre>
      </div>

      {absentOpen && <AbsentModal date={date} day={day} abs={abs} onClose={() => setAbsentOpen(false)} />}
      {shareOpen && (
        <SubsShare
          date={date}
          items={sheetItems}
          usersById={usersById}
          cc={settings.countryCode}
          publish={publish}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

function SubsShare({ date, items, usersById, cc, publish, onClose }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    publish().then((u) => live && setUrl(u)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byTeacher = useMemo(() => {
    const m = new Map();
    for (const i of items) if (i.substituteId) m.set(i.substituteId, [...(m.get(i.substituteId) || []), i]);
    return [...m.entries()];
  }, [items]);

  const personal = (tid, list) => {
    const lines = list.map((i) => `${i.period} (${i.time}) ${i.className}, covering ${i.absent}`);
    return `Hi ${(usersById[tid]?.name || "").split(" ")[0]}, you are covering on ${prettyDate(date)}:\n${lines.join("\n")}${url ? `\n\nFull list: ${url}` : ""}`;
  };

  return (
    <ShareModal
      title="Share cover list"
      text={sheetText(date, items, url)}
      cc={cc}
      url={url}
      busy={!url && !err}
      error={err}
      onClose={onClose}
    >
      {byTeacher.length > 0 && (
        <>
          <h3 className="sub-h">Message each covering teacher</h3>
          <ul className="people-list">
            {byTeacher.map(([tid, list]) => (
              <li key={tid}>
                <div>
                  <strong>{usersById[tid]?.name || "Teacher"}</strong>
                  <span className="muted">{list.length} {list.length === 1 ? "period" : "periods"}{usersById[tid]?.phone ? "" : ", no phone saved"}</span>
                </div>
                <a className="btn small" href={waLink(usersById[tid]?.phone, personal(tid, list), cc)} target="_blank" rel="noreferrer">
                  <Icon name="chat" size={16} />WhatsApp
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </ShareModal>
  );
}

function AbsentModal({ date, day, abs, onClose }) {
  const { profile } = useAuth();
  const { teachers, classes, settings } = useData();
  const toast = useToast();
  const [picked, setPicked] = useState(new Set());
  const [q, setQ] = useState("");
  const [whole, setWhole] = useState(true);
  const [pp, setPp] = useState(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const already = new Set(abs.map((a) => a.teacherId));
  const list = teachers.filter((t) => !already.has(t.id) && (t.name || "").toLowerCase().includes(q.toLowerCase()));
  const lessons = (t) => Object.keys(teacherSlotsOnDay(classes, t.id, day, settings.periods)).length;
  const toggle = (set, setter, id) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    setter(n);
  };

  async function save() {
    if (!picked.size) { toast("Pick at least one teacher"); return; }
    if (!whole && !pp.size) { toast("Pick at least one period"); return; }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      picked.forEach((id) =>
        batch.set(doc(db, "absences", absenceDocId(date, id)), {
          date, teacherId: id, allDay: whole, periods: whole ? [] : [...pp],
          note: note.trim(), createdBy: profile.id, createdAt: serverTimestamp(),
        })
      );
      await batch.commit();
      onClose();
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Mark absent, ${prettyDate(date)}`} onClose={onClose}>
      <label className="field">
        <span>Find a teacher</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name" />
      </label>
      <ul className="pick-list">
        {list.map((t) => (
          <li key={t.id}>
            <label>
              <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(picked, setPicked, t.id)} />
              <span>{t.name}</span>
              <em>{lessons(t)} {lessons(t) === 1 ? "lesson" : "lessons"} today</em>
            </label>
          </li>
        ))}
        {!list.length && <li className="muted">No teachers match.</li>}
      </ul>

      <div className="field">
        <span>How long</span>
        <label className="check"><input type="radio" checked={whole} onChange={() => setWhole(true)} />Whole day</label>
        <label className="check"><input type="radio" checked={!whole} onChange={() => setWhole(false)} />Only some periods</label>
      </div>
      {!whole && (
        <div className="period-pick">
          {settings.periods.filter((p) => !p.isBreak).map((p) => (
            <label key={p.id} className="check">
              <input type="checkbox" checked={pp.has(p.id)} onChange={() => toggle(pp, setPp, p.id)} />{p.label}
            </label>
          ))}
        </div>
      )}
      <label className="field">
        <span>Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Medical leave" />
      </label>
      <div className="actions">
        <button className="btn" onClick={save} disabled={busy}>Save absence</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
